const express = require('express');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();

// GET /api/exams?subject_id=X  -> list tickets with nested questions
router.get('/', requireTeacher, (req, res) => {
  try {
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ error: 'subject_id обязателен' });

    const subject = db.prepare('SELECT id, name, assessment_type FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(404).json({ error: 'Предмет не найден' });

    const tickets = db.prepare('SELECT * FROM exam_tickets WHERE subject_id = ? ORDER BY ticket_number').all(subject_id);
    const stmt = db.prepare('SELECT * FROM exam_questions WHERE ticket_id = ? ORDER BY question_number');

    const result = tickets.map(t => ({
      ...t,
      questions: stmt.all(t.id)
    }));

    res.json({ subject, tickets: result });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/exams/tickets  { subject_id, ticket_number }
router.post('/tickets', requireTeacher, (req, res) => {
  try {
    const { subject_id, ticket_number } = req.body;
    if (!subject_id || !ticket_number) {
      return res.status(400).json({ error: 'subject_id и ticket_number обязательны' });
    }
    const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
    if (!subject) return res.status(400).json({ error: 'Предмет не существует' });

    const result = db.prepare('INSERT INTO exam_tickets (subject_id, ticket_number) VALUES (?, ?)')
      .run(subject_id, Number(ticket_number));
    res.status(201).json({ id: result.lastInsertRowid, subject_id, ticket_number: Number(ticket_number) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/exams/tickets/:id  { ticket_number }
router.put('/tickets/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_tickets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Билет не найден' });

    const { ticket_number } = req.body;
    if (ticket_number === undefined) return res.status(400).json({ error: 'ticket_number обязателен' });

    db.prepare('UPDATE exam_tickets SET ticket_number = ? WHERE id = ?')
      .run(Number(ticket_number), req.params.id);
    res.json({ id: Number(req.params.id), ticket_number: Number(ticket_number) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/exams/tickets/:id
router.delete('/tickets/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_tickets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Билет не найден' });

    db.prepare('DELETE FROM exam_tickets WHERE id = ?').run(req.params.id);
    res.json({ message: 'Билет удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/exams/questions  { ticket_id, question_number, question_text }
router.post('/questions', requireTeacher, (req, res) => {
  try {
    const { ticket_id, question_number, question_text } = req.body;
    if (!ticket_id || !question_text || !question_text.trim()) {
      return res.status(400).json({ error: 'ticket_id и question_text обязательны' });
    }
    const ticket = db.prepare('SELECT id FROM exam_tickets WHERE id = ?').get(ticket_id);
    if (!ticket) return res.status(400).json({ error: 'Билет не существует' });

    const qn = question_number !== undefined ? Number(question_number) : 1;
    const result = db.prepare('INSERT INTO exam_questions (ticket_id, question_number, question_text) VALUES (?, ?, ?)')
      .run(ticket_id, qn, question_text.trim());
    res.status(201).json({ id: result.lastInsertRowid, ticket_id, question_number: qn, question_text: question_text.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/exams/questions/:id  { question_number?, question_text? }
router.put('/questions/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_questions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Вопрос не найден' });

    const { question_number, question_text } = req.body;
    const updates = [];
    const params = [];
    if (question_number !== undefined) { updates.push('question_number = ?'); params.push(Number(question_number)); }
    if (question_text !== undefined) {
      if (!question_text.trim()) return res.status(400).json({ error: 'Текст вопроса не может быть пустым' });
      updates.push('question_text = ?'); params.push(question_text.trim());
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });

    params.push(req.params.id);
    db.prepare(`UPDATE exam_questions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/exams/questions/:id
router.delete('/questions/:id', requireTeacher, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM exam_questions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Вопрос не найден' });

    db.prepare('DELETE FROM exam_questions WHERE id = ?').run(req.params.id);
    res.json({ message: 'Вопрос удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
