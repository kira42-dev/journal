const express = require('express');
const db = require('../db');
const { requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/performance', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }
    if (req.user.role === 'headman') {
      group_id = req.user.group_id;
    }

    const lessons = db.prepare(`
      SELECT l.id, l.lesson_date, t.name AS topic
      FROM lessons l
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.group_id = ? AND l.subject_id = ?
      ORDER BY l.lesson_date
    `).all(group_id, subject_id);

    const students = db.prepare(`
      SELECT id AS student_id, full_name FROM students WHERE group_id = ? ORDER BY full_name
    `).all(group_id);

    const gradesByStudent = {};
    for (const s of students) {
      const grades = db.prepare(`
        SELECT gr.lesson_id, gr.grade, gr.presence, l.lesson_date, t.name AS topic
        FROM grades gr
        JOIN lessons l ON gr.lesson_id = l.id
        LEFT JOIN topics t ON l.topic_id = t.id
        WHERE gr.student_id = ? AND l.subject_id = ?
        ORDER BY l.lesson_date
      `).all(s.student_id, subject_id);

      gradesByStudent[s.student_id] = grades.map(g => ({
        lesson_id: g.lesson_id,
        date: g.lesson_date,
        topic: g.topic,
        grade: g.grade,
        presence: g.presence
      }));
    }

    const result = {
      lessons: lessons.map(l => ({ id: l.id, date: l.lesson_date, topic: l.topic })),
      students: students.map(s => ({
        student_id: s.student_id,
        full_name: s.full_name,
        grades: gradesByStudent[s.student_id] || []
      }))
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/absences', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }
    if (req.user.role === 'headman') {
      group_id = req.user.group_id;
    }

    const absences = db.prepare(`
      SELECT st.id AS student_id, st.full_name,
        SUM(CASE WHEN gr.presence = 0 THEN 1 ELSE 0 END) AS absences
      FROM students st
      LEFT JOIN grades gr ON st.id = gr.student_id
      LEFT JOIN lessons l ON gr.lesson_id = l.id AND l.subject_id = ?
      WHERE st.group_id = ?
      GROUP BY st.id
      ORDER BY st.full_name
    `).all(subject_id, group_id);

    res.json(absences);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/plan-completion', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }
    if (req.user.role === 'headman') {
      group_id = req.user.group_id;
    }

    const subject = db.prepare('SELECT lecture_hours, practice_hours FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(404).json({ error: 'Предмет не найден' });

    const conducted = db.prepare(`
      SELECT lesson_type, SUM(hours) AS total
      FROM lessons
      WHERE group_id = ? AND subject_id = ?
      GROUP BY lesson_type
    `).all(group_id, subject_id);

    const getHours = (type) => {
      const row = conducted.find(c => c.lesson_type === type);
      return row ? row.total : 0;
    };

    const conductedLecture = getHours('lecture');
    const conductedPractice = getHours('practice');
    const totalPlanned = subject.lecture_hours + subject.practice_hours;
    const totalConducted = conductedLecture + conductedPractice;

    res.json({
      planned: { lecture: subject.lecture_hours, practice: subject.practice_hours, total: totalPlanned },
      conducted: { lecture: conductedLecture, practice: conductedPractice, total: totalConducted },
      percent: {
        lecture: totalPlanned > 0 ? Math.round((conductedLecture / subject.lecture_hours) * 10000) / 100 : 0,
        practice: totalPlanned > 0 ? Math.round((conductedPractice / subject.practice_hours) * 10000) / 100 : 0,
        total: totalPlanned > 0 ? Math.round((totalConducted / totalPlanned) * 10000) / 100 : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/student-final-grade', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { student_id, subject_id } = req.query;
    if (!student_id || !subject_id) {
      return res.status(400).json({ error: 'student_id и subject_id обязательны' });
    }

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student) return res.status(404).json({ error: 'Студент не найден' });

    if (req.user.role === 'headman' && student.group_id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const result = db.prepare(`
      SELECT ROUND(AVG(gr.grade), 2) AS avg_grade,
        COUNT(gr.id) AS total_grades,
        SUM(CASE WHEN gr.presence = 0 THEN 1 ELSE 0 END) AS absences
      FROM grades gr
      JOIN lessons l ON gr.lesson_id = l.id
      WHERE gr.student_id = ? AND l.subject_id = ? AND gr.grade IS NOT NULL
    `).get(student_id, subject_id);

    res.json({
      student_id: Number(student_id),
      full_name: student.full_name,
      avg_grade: result.avg_grade,
      total_grades: result.total_grades,
      absences: result.absences || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/debtors', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { group_id, threshold_absences, min_avg } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id обязателен' });
    if (req.user.role === 'headman') {
      group_id = req.user.group_id;
    }

    const threshold = Number(threshold_absences) || 3;
    const minAvg = Number(min_avg) || 3.0;

    const students = db.prepare('SELECT id, full_name FROM students WHERE group_id = ?').all(group_id);
    const debtors = [];

    for (const s of students) {
      const stats = db.prepare(`
        SELECT COALESCE(AVG(gr.grade), 0) AS avg_grade,
          SUM(CASE WHEN gr.presence = 0 THEN 1 ELSE 0 END) AS absences
        FROM students st
        LEFT JOIN grades gr ON st.id = gr.student_id
        LEFT JOIN lessons l ON gr.lesson_id = l.id
        WHERE st.id = ?
      `).get(s.id);

      const avgGrade = stats.avg_grade || 0;
      const absences = stats.absences || 0;

      if (absences > threshold || avgGrade < minAvg) {
        debtors.push({
          student_id: s.id,
          full_name: s.full_name,
          avg_grade: Math.round(avgGrade * 100) / 100,
          absences
        });
      }
    }

    res.json(debtors);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Gradebook matrix: students x lessons with grade, presence, comment per cell
router.get('/gradebook', requireHeadmanOrTeacher, (req, res) => {
  try {
    let { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }
    if (req.user.role === 'headman') {
      group_id = req.user.group_id;
    }

    const group = db.prepare('SELECT id, name, college_id FROM groups_tbl WHERE id = ?').get(group_id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const subject = db.prepare('SELECT id, name, college_id, semester, course, assessment_type FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(404).json({ error: 'Предмет не найден' });

    const lessons = db.prepare(`
      SELECT l.id, l.lesson_date, l.hours, l.lesson_type,
             COALESCE(t.name, '') AS topic
      FROM lessons l
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.group_id = ? AND l.subject_id = ?
      ORDER BY l.lesson_date ASC, l.id ASC
    `).all(group_id, subject_id);

    const students = db.prepare(`
      SELECT id AS student_id, full_name FROM students WHERE group_id = ? ORDER BY full_name
    `).all(group_id);

    const grades = db.prepare(`
      SELECT gr.id AS grade_id, gr.lesson_id AS lesson_id, gr.student_id AS student_id,
             gr.grade, gr.presence, gr.comment
      FROM grades gr
      JOIN lessons l ON gr.lesson_id = l.id
      WHERE l.group_id = ? AND l.subject_id = ?
    `).all(group_id, subject_id);

    const cells = {};
    for (const g of grades) {
      cells[`${g.student_id}:${g.lesson_id}`] = {
        grade_id: g.grade_id,
        grade: g.grade,
        presence: g.presence,
        comment: g.comment || ''
      };
    }

    res.json({
      group: { id: group.id, name: group.name },
      subject: { id: subject.id, name: subject.name, semester: subject.semester, course: subject.course, assessment_type: subject.assessment_type },
      lessons: lessons.map(l => ({ id: l.id, date: l.lesson_date, hours: l.hours, type: l.lesson_type, topic: l.topic })),
      students: students.map(s => ({
        student_id: s.student_id,
        full_name: s.full_name,
        grades: lessons.map(l => cells[`${s.student_id}:${l.id}`] || null)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
