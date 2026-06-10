const express = require('express');
const db = require('../db');
const { requireTeacher, requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireHeadmanOrTeacher, (req, res) => {
  try {
    let query = 'SELECT * FROM students';
    const params = [];
    const conditions = [];

    if (req.query.group_id) {
      conditions.push('group_id = ?');
      params.push(req.query.group_id);
    }

    if (req.user.role === 'headman') {
      conditions.push('group_id = ?');
      params.push(req.user.group_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY full_name';

    const students = db.prepare(query).all(...params);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id', requireHeadmanOrTeacher, (req, res) => {
  try {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ error: 'Студент не найден' });
    if (req.user.role === 'headman' && student.group_id !== req.user.group_id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { full_name, group_id } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'ФИО обязательно' });
    }
    const group = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(group_id);
    if (!group) return res.status(400).json({ error: 'Группа не существует' });
    const result = db.prepare('INSERT INTO students (full_name, group_id) VALUES (?, ?)').run(full_name.trim(), group_id);
    res.status(201).json({ id: result.lastInsertRowid, full_name: full_name.trim(), group_id });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Студент не найден' });
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'ФИО обязательно' });
    db.prepare('UPDATE students SET full_name = ? WHERE id = ?').run(full_name.trim(), req.params.id);
    res.json({ id: Number(req.params.id), full_name: full_name.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id/transfer', requireTeacher, (req, res) => {
  try {
    const { new_group_id } = req.body;
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ error: 'Студент не найден' });

    const newGroup = db.prepare('SELECT id FROM groups_tbl WHERE id = ?').get(new_group_id);
    if (!newGroup) return res.status(400).json({ error: 'Новая группа не существует' });

    db.transaction(() => {
      if (student.group_id) {
        const group = db.prepare('SELECT id FROM groups_tbl WHERE headman_id = ? AND id = ?').get(student.id, student.group_id);
        if (group) {
          db.prepare('UPDATE groups_tbl SET headman_id = NULL WHERE id = ?').run(student.group_id);
        }
      }
      db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(new_group_id, student.id);
    })();

    const updated = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Студент не найден' });

    db.transaction(() => {
      const headmanUser = db.prepare('SELECT id FROM users WHERE role = ? AND student_id = ?').get('headman', Number(req.params.id));
      if (headmanUser) {
        db.prepare('DELETE FROM users WHERE id = ?').run(headmanUser.id);
      }

      const group = db.prepare('SELECT id FROM groups_tbl WHERE headman_id = ?').get(Number(req.params.id));
      if (group) {
        db.prepare('UPDATE groups_tbl SET headman_id = NULL WHERE id = ?').run(group.id);
      }

      db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    })();

    res.json({ message: 'Студент отчислен' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
