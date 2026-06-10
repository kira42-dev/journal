const express = require('express');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const colleges = db.prepare('SELECT id, name FROM colleges ORDER BY id').all();
    res.json(colleges);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название колледжа обязательно' });
    }
    const result = db.prepare('INSERT INTO colleges (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название колледжа обязательно' });
    }
    const existing = db.prepare('SELECT id FROM colleges WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Колледж не найден' });
    }
    db.prepare('UPDATE colleges SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM colleges WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Колледж не найден' });
    }
    db.prepare('DELETE FROM colleges WHERE id = ?').run(req.params.id);
    res.json({ message: 'Колледж удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
