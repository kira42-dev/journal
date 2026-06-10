const express = require('express');
const db = require('../db');
const { requireTeacher, requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireHeadmanOrTeacher, (req, res) => {
  try {
    let query = `SELECT g.*, s.full_name AS headman_name
      FROM groups_tbl g
      LEFT JOIN students s ON g.headman_id = s.id`;
    const params = [];
    const conditions = [];

    if (req.query.college_id) {
      conditions.push('g.college_id = ?');
      params.push(req.query.college_id);
    }

    if (req.user.role === 'headman') {
      conditions.push('g.id = ?');
      params.push(req.user.group_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY g.name';

    const groups = db.prepare(query).all(...params);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', requireHeadmanOrTeacher, (req, res) => {
  try {
    const group = db.prepare(`SELECT g.*, s.full_name AS headman_name
      FROM groups_tbl g
      LEFT JOIN students s ON g.headman_id = s.id
      WHERE g.id = ?`).get(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Группа не найдена' });
    }
    if (req.user.role === 'headman' && group.id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const students = db.prepare('SELECT id, full_name FROM students WHERE group_id = ? ORDER BY full_name').all(req.params.id);
    res.json({ ...group, students });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { college_id, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название группы обязательно' });
    }
    const college = db.prepare('SELECT id FROM colleges WHERE id = ?').get(college_id);
    if (!college) {
      return res.status(400).json({ error: 'Колледж не существует' });
    }
    const result = db.prepare('INSERT INTO groups_tbl (college_id, name) VALUES (?, ?)').run(college_id, name.trim());
    res.status(201).json({ id: result.lastInsertRowid, college_id, name: name.trim(), headman_id: null });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Группа не найдена' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название группы обязательно' });
    db.prepare('UPDATE groups_tbl SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ id: Number(req.params.id), name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/headman', requireTeacher, (req, res) => {
  try {
    const { headman_id } = req.body;
    const group = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    if (headman_id !== null) {
      const student = db.prepare('SELECT id, group_id FROM students WHERE id = ?').get(headman_id);
      if (!student) return res.status(400).json({ error: 'Студент не найден' });
      if (student.group_id !== Number(req.params.id)) {
        return res.status(400).json({ error: 'Студент не принадлежит этой группе' });
      }
    }

    db.prepare('UPDATE groups_tbl SET headman_id = ? WHERE id = ?').run(headman_id, req.params.id);
    res.json({ id: Number(req.params.id), headman_id });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Группа не найдена' });
    db.prepare('DELETE FROM groups_tbl WHERE id = ?').run(req.params.id);
    res.json({ message: 'Группа удалена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
