const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireTeacher, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.student_id, u.created_at, s.full_name AS student_name
      FROM users u
      LEFT JOIN students s ON u.student_id = s.id
      ORDER BY u.id
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireTeacher, (req, res) => {
  try {
    const { username, password, role, student_id } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password и role обязательны' });
    }
    if (!['teacher', 'headman'].includes(role)) {
      return res.status(400).json({ error: 'Роль должна быть teacher или headman' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });

    if (role === 'teacher' && student_id) {
      return res.status(400).json({ error: 'У teacher не может быть student_id' });
    }
    if (role === 'headman') {
      if (!student_id) return res.status(400).json({ error: 'Для headman student_id обязателен' });
      const student = db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
      if (!student) return res.status(400).json({ error: 'Студент не найден' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, role, student_id) VALUES (?, ?, ?, ?)').run(username, hash, role, student_id || null);
    res.status(201).json({ id: result.lastInsertRowid, username, role, student_id: student_id || null });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пользователь не найден' });

    const { username, password, role, student_id } = req.body;
    const updates = [];
    const params = [];

    if (username !== undefined) {
      const dup = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
      if (dup) return res.status(409).json({ error: 'Логин уже занят' });
      updates.push('username = ?');
      params.push(username);
    }
    if (password !== undefined) {
      updates.push('password_hash = ?');
      params.push(bcrypt.hashSync(password, 10));
    }
    if (role !== undefined) {
      if (!['teacher', 'headman'].includes(role)) return res.status(400).json({ error: 'Роль должна быть teacher или headman' });
      updates.push('role = ?');
      params.push(role);
    }
    if (student_id !== undefined) {
      if (student_id !== null) {
        const student = db.prepare('SELECT id FROM students WHERE id = ?').get(student_id);
        if (!student) return res.status(400).json({ error: 'Студент не найден' });
      }
      updates.push('student_id = ?');
      params.push(student_id);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });
    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const updated = db.prepare('SELECT id, username, role, student_id, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Пользователь не найден' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
