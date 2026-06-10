const express = require('express');
const db = require('../db');
const { requireTeacher, requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

function filterGradesForRole(grades, role) {
  if (role === 'headman') {
    return grades.map(g => {
      const { comment, ...rest } = g;
      return rest;
    });
  }
  return grades;
}

router.get('/', requireHeadmanOrTeacher, (req, res) => {
  try {
    const { lesson_id } = req.query;
    if (!lesson_id) return res.status(400).json({ error: 'lesson_id обязателен' });

    const lesson = db.prepare('SELECT group_id FROM lessons WHERE id = ?').get(lesson_id);
    if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });
    if (req.user.role === 'headman' && lesson.group_id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    let grades = db.prepare(`SELECT gr.*, st.full_name
      FROM grades gr
      JOIN students st ON gr.student_id = st.id
      WHERE gr.lesson_id = ?
      ORDER BY st.full_name`).all(lesson_id);

    grades = filterGradesForRole(grades, req.user.role);
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/student/:student_id', requireHeadmanOrTeacher, (req, res) => {
  try {
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ error: 'subject_id обязателен' });

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.student_id);
    if (!student) return res.status(404).json({ error: 'Студент не найден' });
    if (req.user.role === 'headman' && student.group_id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    let grades = db.prepare(`
      SELECT gr.*, l.lesson_date, l.lesson_type, s.name AS subject_name, t.name AS topic_name
      FROM grades gr
      JOIN lessons l ON gr.lesson_id = l.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE gr.student_id = ? AND l.subject_id = ?
      ORDER BY l.lesson_date
    `).all(req.params.student_id, subject_id);

    grades = filterGradesForRole(grades, req.user.role);
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/group-stats', requireHeadmanOrTeacher, (req, res) => {
  try {
    const { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }

    if (req.user.role === 'headman' && Number(group_id) !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const stats = db.prepare(`
      SELECT st.id AS student_id, st.full_name,
        ROUND(AVG(gr.grade), 2) AS avg_grade,
        SUM(CASE WHEN gr.presence = 0 THEN 1 ELSE 0 END) AS absences
      FROM students st
      LEFT JOIN grades gr ON st.id = gr.student_id
      LEFT JOIN lessons l ON gr.lesson_id = l.id AND l.subject_id = ?
      WHERE st.group_id = ?
      GROUP BY st.id
      ORDER BY st.full_name
    `).all(subject_id, group_id);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { lesson_id, student_id, grade, comment, presence } = req.body;
    if (!lesson_id || !student_id) {
      return res.status(400).json({ error: 'lesson_id и student_id обязательны' });
    }

    const lesson = db.prepare('SELECT id, group_id FROM lessons WHERE id = ?').get(lesson_id);
    if (!lesson) return res.status(400).json({ error: 'Занятие не существует' });

    const student = db.prepare('SELECT id, group_id FROM students WHERE id = ?').get(student_id);
    if (!student) return res.status(400).json({ error: 'Студент не существует' });
    if (student.group_id !== lesson.group_id) {
      return res.status(400).json({ error: 'Студент не принадлежит к группе занятия' });
    }

    if (grade !== null && grade !== undefined && (grade < 2 || grade > 5)) {
      return res.status(400).json({ error: 'Оценка должна быть от 2 до 5 или null' });
    }
    if (presence !== undefined && ![0, 1].includes(presence)) {
      return res.status(400).json({ error: 'Присутствие должно быть 0 или 1' });
    }

    try {
      const result = db.prepare('INSERT INTO grades (lesson_id, student_id, grade, comment, presence) VALUES (?, ?, ?, ?, ?)').run(
        lesson_id, student_id,
        grade !== undefined ? grade : null,
        comment || null,
        presence !== undefined ? presence : 1
      );
      res.status(201).json({ id: result.lastInsertRowid, lesson_id, student_id, grade: grade || null, comment: comment || null, presence: presence !== undefined ? presence : 1 });
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Запись для этого студента на это занятие уже существует' });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM grades WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Запись не найдена' });

    const { grade, comment, presence } = req.body;
    if (grade !== undefined && grade !== null && (grade < 2 || grade > 5)) {
      return res.status(400).json({ error: 'Оценка должна быть от 2 до 5 или null' });
    }
    if (presence !== undefined && ![0, 1].includes(presence)) {
      return res.status(400).json({ error: 'Присутствие должно быть 0 или 1' });
    }

    const updates = [];
    const params = [];
    if (grade !== undefined) { updates.push('grade = ?'); params.push(grade); }
    if (comment !== undefined) { updates.push('comment = ?'); params.push(comment); }
    if (presence !== undefined) { updates.push('presence = ?'); params.push(presence); }

    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE grades SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM grades WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Запись не найдена' });
    db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id);
    res.json({ message: 'Запись удалена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
