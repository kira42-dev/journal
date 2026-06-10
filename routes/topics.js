const express = require('express');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    let query = 'SELECT * FROM topics';
    const params = [];
    if (req.query.subject_id) {
      query += ' WHERE subject_id = ?';
      params.push(req.query.subject_id);
    }
    query += ' ORDER BY order_index';
    const topics = db.prepare(query).all(...params);
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { subject_id, name, order_index } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название темы обязательно' });
    }
    const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) {
      return res.status(400).json({ error: 'Предмет не существует' });
    }
    const oi = order_index !== undefined ? order_index : 0;
    const result = db.prepare('INSERT INTO topics (subject_id, name, order_index) VALUES (?, ?, ?)').run(subject_id, name.trim(), oi);
    res.status(201).json({ id: result.lastInsertRowid, subject_id, name: name.trim(), order_index: oi });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Тема не найдена' });
    }
    const { name, subject_id, order_index } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (subject_id !== undefined) {
      const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
      if (!subject) return res.status(400).json({ error: 'Предмет не существует' });
      updates.push('subject_id = ?'); params.push(subject_id);
    }
    if (order_index !== undefined) { updates.push('order_index = ?'); params.push(order_index); }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE topics SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Тема не найдена' });
    }
    db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);
    res.json({ message: 'Тема удалена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
