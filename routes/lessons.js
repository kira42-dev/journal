const express = require('express');
const db = require('../db');
const { requireTeacher, requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireHeadmanOrTeacher, (req, res) => {
  try {
    let query = `SELECT l.*, g.name AS group_name, s.name AS subject_name, t.name AS topic_name
      FROM lessons l
      JOIN groups_tbl g ON l.group_id = g.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN topics t ON l.topic_id = t.id`;
    const params = [];
    const conditions = [];

    if (req.query.group_id) {
      conditions.push('l.group_id = ?');
      params.push(req.query.group_id);
    }
    if (req.query.subject_id) {
      conditions.push('l.subject_id = ?');
      params.push(req.query.subject_id);
    }
    if (req.query.date) {
      conditions.push('l.lesson_date = ?');
      params.push(req.query.date);
    }
    if (req.query.lesson_type) {
      conditions.push('l.lesson_type = ?');
      params.push(req.query.lesson_type);
    }

    if (req.user.role === 'headman') {
      conditions.push('l.group_id = ?');
      params.push(req.user.group_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY l.lesson_date DESC, l.id';

    const lessons = db.prepare(query).all(...params);
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/hours-remaining', requireHeadmanOrTeacher, (req, res) => {
  try {
    const { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }

    const subject = db.prepare('SELECT lecture_hours, practice_hours FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(404).json({ error: 'Предмет не найден' });

    const conducted = db.prepare(`
      SELECT lesson_type, SUM(hours) AS total
      FROM lessons
      WHERE group_id = ? AND subject_id = ?
      GROUP BY lesson_type
    `).all(group_id, subject_id);

    const conductedLecture = conducted.find(c => c.lesson_type === 'lecture');
    const conductedPractice = conducted.find(c => c.lesson_type === 'practice');

    const conductedLectureHours = conductedLecture ? conductedLecture.total : 0;
    const conductedPracticeHours = conductedPractice ? conductedPractice.total : 0;

    res.json({
      planned: { lecture: subject.lecture_hours, practice: subject.practice_hours },
      conducted: { lecture: conductedLectureHours, practice: conductedPracticeHours },
      remaining: {
        lecture: subject.lecture_hours - conductedLectureHours,
        practice: subject.practice_hours - conductedPracticeHours
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', requireHeadmanOrTeacher, (req, res) => {
  try {
    const lesson = db.prepare(`SELECT l.*, g.name AS group_name, s.name AS subject_name, t.name AS topic_name
      FROM lessons l
      JOIN groups_tbl g ON l.group_id = g.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.id = ?`).get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Занятие не найдено' });

    if (req.user.role === 'headman' && lesson.group_id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const grades = db.prepare(`SELECT gr.*, st.full_name
      FROM grades gr
      JOIN students st ON gr.student_id = st.id
      WHERE gr.lesson_id = ?
      ORDER BY st.full_name`).all(req.params.id);

    res.json({ ...lesson, grades });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { group_id, subject_id, topic_id, lesson_date, hours, lesson_type } = req.body;

    if (!group_id || !subject_id || !lesson_date || !hours || !lesson_type) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
    }
    if (hours <= 0) return res.status(400).json({ error: 'Часы должны быть больше 0' });
    if (!['lecture', 'practice'].includes(lesson_type)) {
      return res.status(400).json({ error: 'Тип занятия должен быть lecture или practice' });
    }

    const group = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(group_id);
    if (!group) return res.status(400).json({ error: 'Группа не существует' });

    const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(400).json({ error: 'Предмет не существует' });

    const collegeMatch = db.prepare(`
      SELECT groups_tbl.college_id AS g_col, subjects.college_id AS s_col
      FROM groups_tbl, subjects
      WHERE groups_tbl.id = ? AND subjects.id = ?
    `).get(group_id, subject_id);
    if (collegeMatch && collegeMatch.g_col !== collegeMatch.s_col) {
      return res.status(400).json({ error: 'Колледж группы и предмета не совпадают' });
    }

    if (topic_id) {
      const topic = db.prepare('SELECT id, subject_id FROM topics WHERE id = ?').get(topic_id);
      if (!topic) return res.status(400).json({ error: 'Тема не существует' });
      if (topic.subject_id !== Number(subject_id)) {
        return res.status(400).json({ error: 'Тема не принадлежит этому предмету' });
      }
    }

    const result = db.prepare('INSERT INTO lessons (group_id, subject_id, topic_id, lesson_date, hours, lesson_type) VALUES (?, ?, ?, ?, ?, ?)').run(group_id, subject_id, topic_id || null, lesson_date, hours, lesson_type);
    res.status(201).json({ id: result.lastInsertRowid, group_id, subject_id, topic_id: topic_id || null, lesson_date, hours, lesson_type });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Занятие не найдено' });

    const { group_id, subject_id, topic_id, lesson_date, hours, lesson_type } = req.body;

    if (hours !== undefined && hours <= 0) return res.status(400).json({ error: 'Часы должны быть больше 0' });
    if (lesson_type !== undefined && !['lecture', 'practice'].includes(lesson_type)) {
      return res.status(400).json({ error: 'Тип занятия должен быть lecture или practice' });
    }

    if (group_id) {
      const group = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(group_id);
      if (!group) return res.status(400).json({ error: 'Группа не существует' });
    }
    if (subject_id) {
      const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
      if (!subject) return res.status(400).json({ error: 'Предмет не существует' });
    }

    const gid = group_id || existing.group_id;
    const sid = subject_id || existing.subject_id;
    const collegeMatch = db.prepare(`
      SELECT groups_tbl.college_id AS g_col, subjects.college_id AS s_col
      FROM groups_tbl, subjects
      WHERE groups_tbl.id = ? AND subjects.id = ?
    `).get(gid, sid);
    if (collegeMatch && collegeMatch.g_col !== collegeMatch.s_col) {
      return res.status(400).json({ error: 'Колледж группы и предмета не совпадают' });
    }

    if (topic_id !== undefined && topic_id !== null) {
      const topic = db.prepare('SELECT id, subject_id FROM topics WHERE id = ?').get(topic_id);
      if (!topic) return res.status(400).json({ error: 'Тема не существует' });
      if (topic.subject_id !== Number(sid)) {
        return res.status(400).json({ error: 'Тема не принадлежит этому предмету' });
      }
    }

    const updates = [];
    const params = [];
    if (group_id !== undefined) { updates.push('group_id = ?'); params.push(group_id); }
    if (subject_id !== undefined) { updates.push('subject_id = ?'); params.push(subject_id); }
    if (topic_id !== undefined) { updates.push('topic_id = ?'); params.push(topic_id); }
    if (lesson_date !== undefined) { updates.push('lesson_date = ?'); params.push(lesson_date); }
    if (hours !== undefined) { updates.push('hours = ?'); params.push(hours); }
    if (lesson_type !== undefined) { updates.push('lesson_type = ?'); params.push(lesson_type); }

    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Занятие не найдено' });
    db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
    res.json({ message: 'Занятие удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
