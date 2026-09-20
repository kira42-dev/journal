const express = require('express');
const db = require('../db');
const { requireHeadmanOrTeacher } = require('../middleware/auth');

const router = express.Router();

let XLSX = null;

function getXlsx() {
  if (!XLSX) XLSX = require('xlsx');
  return XLSX;
}

const ENTITY_CONFIG = {
  colleges: {
    query: 'SELECT id, name FROM colleges ORDER BY id',
    headers: ['ID', 'Название колледжа'],
    sheet: 'Колледжи'
  },
  subjects: {
    query: `SELECT s.id, s.name, c.name AS college, s.lecture_hours, s.practice_hours
      FROM subjects s JOIN colleges c ON s.college_id = c.id ORDER BY s.id`,
    headers: ['ID', 'Название предмета', 'Колледж', 'Лекции (ч)', 'Практика (ч)'],
    sheet: 'Предметы'
  },
  topics: {
    query: `SELECT t.id, s.name AS subject, t.name, t.order_index
      FROM topics t JOIN subjects s ON t.subject_id = s.id ORDER BY t.order_index`,
    headers: ['ID', 'Предмет', 'Название темы', 'Порядок'],
    sheet: 'Темы'
  },
  groups: {
    query: `SELECT g.id, g.name, c.name AS college, s.full_name AS headman
      FROM groups_tbl g
      JOIN colleges c ON g.college_id = c.id
      LEFT JOIN students s ON g.headman_id = s.id ORDER BY g.name`,
    headers: ['ID', 'Группа', 'Колледж', 'Староста'],
    sheet: 'Группы'
  },
  students: {
    query: `SELECT st.id, st.full_name, g.name AS group_name
      FROM students st JOIN groups_tbl g ON st.group_id = g.id ORDER BY g.name, st.full_name`,
    headers: ['ID', 'ФИО студента', 'Группа'],
    sheet: 'Студенты'
  },
  lessons: {
    query: `SELECT l.id, g.name AS group_name, s.name AS subject_name, t.name AS topic_name,
        l.lesson_date, l.hours, l.lesson_type
      FROM lessons l
      JOIN groups_tbl g ON l.group_id = g.id
      JOIN subjects s ON l.subject_id = s.id
      LEFT JOIN topics t ON l.topic_id = t.id
      ORDER BY l.lesson_date, l.id`,
    headers: ['ID', 'Группа', 'Предмет', 'Тема', 'Дата', 'Часы', 'Тип занятия'],
    sheet: 'Занятия'
  }
};

function mapLessonType(type) {
  return type === 'lecture' ? 'Лекция' : 'Практика';
}

function normalizeRow(entity, row) {
  const cls = {};
  ENTITY_CONFIG[entity].headers.forEach((h, i) => {
    cls[h] = row[i];
  });
  if (entity === 'lessons') {
    cls['Тип занятия'] = mapLessonType(row[6]);
  }
  return cls;
}

function buildWorkbook() {
  const wb = XLSX.utils.book_new();
  for (const key of Object.keys(ENTITY_CONFIG)) {
    const cfg = ENTITY_CONFIG[key];
    const rows = db.prepare(cfg.query).all();
    const data = rows.map(r => normalizeRow(key, Object.values(r)));
    const ws = XLSX.utils.json_to_sheet(data, { header: cfg.headers });
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheet);
  }
  return wb;
}

function sendWorkbook(res, wb, filename) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', compression: true });
  const asciiName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

router.get('/', requireHeadmanOrTeacher, (req, res) => {
  try {
    getXlsx();
    const type = ENTITY_CONFIG[req.query.type];
    if (!type) {
      return res.status(400).json({ error: 'Неизвестный тип экспорта, допустимые: ' + Object.keys(ENTITY_CONFIG).join(', ') });
    }

    const rows = db.prepare(type.query).all();
    const data = rows.map(r => normalizeRow(req.query.type, Object.values(r)));

    if (req.query.format === 'csv') {
      const ws = XLSX.utils.json_to_sheet(data, { header: type.headers });
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Disposition', `attachment; filename="${req.query.type}.csv"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send('\uFEFF' + csv);
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: type.headers });
    XLSX.utils.book_append_sheet(wb, ws, type.sheet);
    sendWorkbook(res, wb, `${req.query.type}.xlsx`);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.get('/all', requireHeadmanOrTeacher, (req, res) => {
  try {
    getXlsx();
    const wb = buildWorkbook();
    sendWorkbook(res, wb, 'journal-export.xlsx');
  } catch (err) {
    console.error('Export all error:', err);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

router.get('/journal', requireHeadmanOrTeacher, (req, res) => {
  try {
    getXlsx();
    let { group_id, subject_id } = req.query;
    if (!group_id || !subject_id) {
      return res.status(400).json({ error: 'group_id и subject_id обязательны' });
    }
    if (req.user.role === 'headman') group_id = req.user.group_id;

    const group = db.prepare('SELECT name FROM groups_tbl WHERE id = ?').get(group_id);
    const subject = db.prepare('SELECT name FROM subjects WHERE id = ?').get(subject_id);
    if (!group || !subject) return res.status(404).json({ error: 'Группа или предмет не найдены' });

    const lessons = db.prepare(`
      SELECT l.id, l.lesson_date, t.name AS topic, l.hours, l.lesson_type
      FROM lessons l
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.group_id = ? AND l.subject_id = ?
      ORDER BY l.lesson_date, l.id
    `).all(group_id, subject_id);

    const students = db.prepare('SELECT id, full_name FROM students WHERE group_id = ? ORDER BY full_name').all(group_id);

    const gradesByLessonStudent = {};
    const gradeRows = db.prepare(`
      SELECT gr.lesson_id, gr.student_id, gr.grade, gr.presence, gr.comment
      FROM grades gr
      JOIN lessons l ON gr.lesson_id = l.id
      WHERE l.group_id = ? AND l.subject_id = ?
    `).all(group_id, subject_id);

    for (const g of gradeRows) {
      const key = `${g.lesson_id}_${g.student_id}`;
      gradesByLessonStudent[key] = g;
    }

    const header = ['ФИО студента'];
    lessons.forEach(l => {
      const shortDate = String(l.lesson_date).split('T')[0] || l.lesson_date;
      header.push(`${shortDate} ${l.topic || '—'}`);
    });

    const rows = students.map(s => {
      const row = [s.full_name];
      lessons.forEach(l => {
        const g = gradesByLessonStudent[`${l.id}_${s.id}`];
        if (!g) {
          row.push('');
        } else if (g.presence === 0) {
          row.push('н');
        } else if (g.grade !== null) {
          row.push(g.grade);
        } else {
          row.push('✔');
        }
      });
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [{ wch: 30 }, ...lessons.map(() => ({ wch: 22 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    const filename = `journal-${group.name}-${subject.name}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
    sendWorkbook(res, wb, filename);
  } catch (err) {
    console.error('Export journal error:', err);
    res.status(500).json({ error: 'Ошибка экспорта журнала' });
  }
});

module.exports = router;