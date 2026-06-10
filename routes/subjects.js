const express = require('express');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    let query = 'SELECT *, (lecture_hours + practice_hours) AS total_hours FROM subjects';
    const params = [];
    if (req.query.college_id) {
      query += ' WHERE college_id = ?';
      params.push(req.query.college_id);
    }
    query += ' ORDER BY id';
    const subjects = db.prepare(query).all(...params);
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const subject = db.prepare('SELECT *, (lecture_hours + practice_hours) AS total_hours FROM subjects WHERE id = ?').get(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { college_id, name, lecture_hours, practice_hours } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название предмета обязательно' });
    }
    const college = db.prepare('SELECT id FROM colleges WHERE id = ?').get(college_id);
    if (!college) {
      return res.status(400).json({ error: 'Колледж не существует' });
    }
    const lh = Number(lecture_hours) || 0;
    const ph = Number(practice_hours) || 0;
    if (lh < 0 || ph < 0) {
      return res.status(400).json({ error: 'Часы не могут быть отрицательными' });
    }
    const result = db.prepare('INSERT INTO subjects (college_id, name, lecture_hours, practice_hours) VALUES (?, ?, ?, ?)').run(college_id, name.trim(), lh, ph);
    res.status(201).json({ id: result.lastInsertRowid, college_id, name: name.trim(), lecture_hours: lh, practice_hours: ph, total_hours: lh + ph });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    const { name, college_id, lecture_hours, practice_hours } = req.body;
    const lh = lecture_hours !== undefined ? Number(lecture_hours) : undefined;
    const ph = practice_hours !== undefined ? Number(practice_hours) : undefined;

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Название предмета обязательно' });
    }
    if (college_id !== undefined) {
      const college = db.prepare('SELECT id FROM colleges WHERE id = ?').get(college_id);
      if (!college) return res.status(400).json({ error: 'Колледж не существует' });
    }
    if ((lh !== undefined && lh < 0) || (ph !== undefined && ph < 0)) {
      return res.status(400).json({ error: 'Часы не могут быть отрицательными' });
    }

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (college_id !== undefined) { updates.push('college_id = ?'); params.push(college_id); }
    if (lh !== undefined) { updates.push('lecture_hours = ?'); params.push(lh); }
    if (ph !== undefined) { updates.push('practice_hours = ?'); params.push(ph); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT *, (lecture_hours + practice_hours) AS total_hours FROM subjects WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Предмет удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
