const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireTeacher } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function sendXlsx(res, rows, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.end(buf);
}

// ============ IMPORT ============

router.post('/import/subjects', requireTeacher, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const rows = parseSheet(req.file.buffer);
    let imported = 0;
    let errors = [];

    const insert = db.prepare(`INSERT OR IGNORE INTO subjects
      (college_id, name, lecture_hours, practice_hours, semester, course, assessment_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    const tx = db.transaction(() => {
      rows.forEach((r, i) => {
        const name = (r['Название'] || r['name'] || '').toString().trim();
        if (!name) {
          errors.push(`Строка ${i + 2}: нет названия`);
          return;
        }
        const college = (r['Колледж'] || r['college_id'] || '1').toString();
        const collegeRow = db.prepare('SELECT id FROM colleges WHERE name = ? OR id = ?')
          .get(college, Number(college) || 0);
        if (!collegeRow) {
          errors.push(`Строка ${i + 2}: колледж «${college}» не найден`);
          return;
        }
        const assessment = ['exam', 'zachet'].includes(String(r['Форма контроля'] || ''))
          ? String(r['Форма контроля'])
          : 'zachet';
        try {
          const result = insert.run(
            collegeRow.id,
            name,
            Number(r['Лекции'] || r['lecture_hours'] || 0),
            Number(r['Практика'] || r['practice_hours'] || 0),
            Number(r['Семестр'] || r['semester'] || 1),
            Number(r['Курс'] || r['course'] || 1),
            assessment
          );
          if (result.changes > 0) imported++;
          else errors.push(`Строка ${i + 2}: предмет «${name}» уже существует`);
        } catch (e) {
          errors.push(`Строка ${i + 2}: ${e.message}`);
        }
      });
    });
    tx();

    res.json({ imported, errors });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта' });
  }
});

router.post('/import/groups', requireTeacher, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const rows = parseSheet(req.file.buffer);
    let imported = 0;
    let errors = [];
    const insert = db.prepare('INSERT OR IGNORE INTO groups_tbl (college_id, name) VALUES (?, ?)');

    const tx = db.transaction(() => {
      rows.forEach((r, i) => {
        const name = (r['Название'] || r['name'] || '').toString().trim();
        if (!name) { errors.push(`Строка ${i + 2}: нет названия`); return; }
        const college = (r['Колледж'] || r['college_id'] || '1').toString();
        const collegeRow = db.prepare('SELECT id FROM colleges WHERE name = ? OR id = ?')
          .get(college, Number(college) || 0);
        if (!collegeRow) { errors.push(`Строка ${i + 2}: колледж «${college}» не найден`); return; }
        try {
          const result = insert.run(collegeRow.id, name);
          if (result.changes > 0) imported++;
          else errors.push(`Строка ${i + 2}: группа «${name}» уже существует`);
        } catch (e) {
          errors.push(`Строка ${i + 2}: ${e.message}`);
        }
      });
    });
    tx();

    res.json({ imported, errors });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта' });
  }
});

router.post('/import/students', requireTeacher, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const rows = parseSheet(req.file.buffer);
    let imported = 0;
    let errors = [];
    const insert = db.prepare('INSERT OR IGNORE INTO students (full_name, group_id) VALUES (?, ?)');

    const tx = db.transaction(() => {
      rows.forEach((r, i) => {
        const fullName = (r['ФИО'] || r['full_name'] || r['Студент'] || '').toString().trim();
        if (!fullName) { errors.push(`Строка ${i + 2}: нет ФИО`); return; }
        const group = (r['Группа'] || r['group'] || r['group_id'] || '').toString().trim();
        if (!group) { errors.push(`Строка ${i + 2}: не указана группа для «${fullName}»`); return; }
        const groupRow = db.prepare('SELECT id FROM groups_tbl WHERE name = ? OR id = ?')
          .get(group, Number(group) || 0);
        if (!groupRow) { errors.push(`Строка ${i + 2}: группа «${group}» не найдена`); return; }
        try {
          const result = insert.run(fullName, groupRow.id);
          if (result.changes > 0) imported++;
          else errors.push(`Строка ${i + 2}: студент «${fullName}» уже существует`);
        } catch (e) {
          errors.push(`Строка ${i + 2}: ${e.message}`);
        }
      });
    });
    tx();

    res.json({ imported, errors });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта' });
  }
});

router.post('/import/topics', requireTeacher, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const rows = parseSheet(req.file.buffer);
    let imported = 0;
    let errors = [];
    const insert = db.prepare('INSERT OR IGNORE INTO topics (subject_id, name, order_index) VALUES (?, ?, ?)');

    const tx = db.transaction(() => {
      rows.forEach((r, i) => {
        const name = (r['Тема'] || r['name'] || '').toString().trim();
        if (!name) { errors.push(`Строка ${i + 2}: нет темы`); return; }
        const subject = (r['Предмет'] || r['subject'] || r['subject_id'] || '').toString().trim();
        if (!subject) { errors.push(`Строка ${i + 2}: не указан предмет для «${name}»`); return; }
        const subjectRow = db.prepare('SELECT id FROM subjects WHERE name = ? OR id = ?')
          .get(subject, Number(subject) || 0);
        if (!subjectRow) { errors.push(`Строка ${i + 2}: предмет «${subject}» не найден`); return; }
        try {
          const result = insert.run(subjectRow.id, name, Number(r['Порядок'] || r['order_index'] || 0));
          if (result.changes > 0) imported++;
          else errors.push(`Строка ${i + 2}: тема «${name}» уже существует`);
        } catch (e) {
          errors.push(`Строка ${i + 2}: ${e.message}`);
        }
      });
    });
    tx();

    res.json({ imported, errors });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта' });
  }
});

// ============ EXPORT ============

router.get('/export/subjects', requireTeacher, (req, res) => {
  try {
    const collegeId = req.query.college_id;
    let rows;
    if (collegeId) {
      rows = db.prepare(`
        SELECT s.name AS 'Название', c.name AS 'Колледж', s.course AS 'Курс',
               s.semester AS 'Семестр', s.lecture_hours AS 'Лекции',
               s.practice_hours AS 'Практика',
               CASE WHEN s.assessment_type='exam' THEN 'exam' ELSE 'zachet' END AS 'Форма контроля'
        FROM subjects s JOIN colleges c ON s.college_id = c.id
        WHERE s.college_id = ? ORDER BY s.course, s.semester
      `).all(collegeId);
    } else {
      rows = db.prepare(`
        SELECT s.name AS 'Название', c.name AS 'Колледж', s.course AS 'Курс',
               s.semester AS 'Семестр', s.lecture_hours AS 'Лекции',
               s.practice_hours AS 'Практика',
               CASE WHEN s.assessment_type='exam' THEN 'exam' ELSE 'zachet' END AS 'Форма контроля'
        FROM subjects s JOIN colleges c ON s.college_id = c.id
        ORDER BY s.course, s.semester
      `).all();
    }
    sendXlsx(res, rows, 'Предметы', 'subjects.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.get('/export/groups', requireTeacher, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT g.name AS 'Название', c.name AS 'Колледж'
      FROM groups_tbl g JOIN colleges c ON g.college_id = c.id
      ORDER BY g.name
    `).all();
    sendXlsx(res, rows, 'Группы', 'groups.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.get('/export/students', requireTeacher, (req, res) => {
  try {
    const groupId = req.query.group_id;
    let rows;
    if (groupId) {
      rows = db.prepare(`
        SELECT st.full_name AS 'ФИО', g.name AS 'Группа'
        FROM students st JOIN groups_tbl g ON st.group_id = g.id
        WHERE st.group_id = ? ORDER BY st.full_name
      `).all(groupId);
    } else {
      rows = db.prepare(`
        SELECT st.full_name AS 'ФИО', g.name AS 'Группа'
        FROM students st JOIN groups_tbl g ON st.group_id = g.id
        ORDER BY g.name, st.full_name
      `).all();
    }
    sendXlsx(res, rows, 'Студенты', 'students.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.get('/export/topics', requireTeacher, (req, res) => {
  try {
    const subjectId = req.query.subject_id;
    let rows;
    if (subjectId) {
      rows = db.prepare(`
        SELECT t.name AS 'Тема', s.name AS 'Предмет', t.order_index AS 'Порядок'
        FROM topics t JOIN subjects s ON t.subject_id = s.id
        WHERE t.subject_id = ? ORDER BY t.order_index
      `).all(subjectId);
    } else {
      rows = db.prepare(`
        SELECT t.name AS 'Тема', s.name AS 'Предмет', t.order_index AS 'Порядок'
        FROM topics t JOIN subjects s ON t.subject_id = s.id
        ORDER BY s.name, t.order_index
      `).all();
    }
    sendXlsx(res, rows, 'Темы', 'topics.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

module.exports = router;