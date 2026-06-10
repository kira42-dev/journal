const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'journal.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lecture_hours INTEGER NOT NULL DEFAULT 0,
    practice_hours INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS groups_tbl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    headman_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    group_id INTEGER NOT NULL REFERENCES groups_tbl(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups_tbl(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    lesson_date TEXT NOT NULL,
    hours REAL NOT NULL,
    lesson_type TEXT NOT NULL CHECK(lesson_type IN ('lecture', 'practice'))
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    grade INTEGER CHECK(grade IS NULL OR (grade >= 2 AND grade <= 5)),
    comment TEXT,
    presence INTEGER NOT NULL DEFAULT 1 CHECK(presence IN (0,1))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_lesson_student ON grades(lesson_id, student_id);

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'headman')),
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const collegeCount = db.prepare('SELECT COUNT(*) AS cnt FROM colleges').get();
if (collegeCount.cnt === 0) {
  const insertCollege = db.prepare('INSERT INTO colleges (id, name) VALUES (?, ?)');
  insertCollege.run(1, 'Колледж информационных технологий');

  const insertSubject = db.prepare('INSERT INTO subjects (id, college_id, name, lecture_hours, practice_hours) VALUES (?, ?, ?, ?, ?)');
  insertSubject.run(1, 1, 'Программирование на JavaScript', 40, 60);

  const insertTopic = db.prepare('INSERT INTO topics (id, subject_id, name, order_index) VALUES (?, ?, ?, ?)');
  insertTopic.run(1, 1, 'Введение в JavaScript', 1);

  const insertGroup = db.prepare('INSERT INTO groups_tbl (id, college_id, name, headman_id) VALUES (?, ?, ?, ?)');
  insertGroup.run(1, 1, 'ИТ-31', 2);

  const insertStudent = db.prepare('INSERT INTO students (id, full_name, group_id) VALUES (?, ?, ?)');
  insertStudent.run(1, 'Иванов Иван Иванович', 1);
  insertStudent.run(2, 'Петров Пётр Петрович', 1);

  const hashTeacher = bcrypt.hashSync('teacher123', 10);
  const hashHeadman = bcrypt.hashSync('headman123', 10);

  const insertUser = db.prepare('INSERT INTO users (username, password_hash, role, student_id) VALUES (?, ?, ?, ?)');
  insertUser.run('teacher', hashTeacher, 'teacher', null);
  insertUser.run('headman1', hashHeadman, 'headman', 2);
}

module.exports = db;
