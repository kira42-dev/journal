const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'college-journal-secret-key-2024';

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Доступ запрещён. Требуется роль teacher' });
  }
  next();
}

function requireHeadmanOrTeacher(req, res, next) {
  if (req.user.role === 'teacher') {
    return next();
  }

  if (req.user.role === 'headman') {
    try {
      const user = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.user.id);
      if (!user || !user.student_id) {
        return res.status(403).json({ error: 'Староста не привязан к студенту' });
      }

      const student = db.prepare('SELECT group_id FROM students WHERE id = ?').get(user.student_id);
      if (!student) {
        return res.status(403).json({ error: 'Студент не найден' });
      }

      req.user.group_id = student.group_id;
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  } else {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
}

module.exports = { verifyToken, requireTeacher, requireHeadmanOrTeacher, JWT_SECRET };
