const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/auth');
const collegesRoutes = require('./routes/colleges');
const subjectsRoutes = require('./routes/subjects');
const topicsRoutes = require('./routes/topics');
const groupsRoutes = require('./routes/groups');
const studentsRoutes = require('./routes/students');
const lessonsRoutes = require('./routes/lessons');
const gradesRoutes = require('./routes/grades');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const examsRoutes = require('./routes/exams');
const importExportRoutes = require('./routes/import-export');

app.use('/api/auth', authRoutes);
app.use('/api/colleges', verifyToken, collegesRoutes);
app.use('/api/subjects', verifyToken, subjectsRoutes);
app.use('/api/topics', verifyToken, topicsRoutes);
app.use('/api/groups', verifyToken, groupsRoutes);
app.use('/api/students', verifyToken, studentsRoutes);
app.use('/api/lessons', verifyToken, lessonsRoutes);
app.use('/api/grades', verifyToken, gradesRoutes);
app.use('/api/users', verifyToken, usersRoutes);
app.use('/api/reports', verifyToken, reportsRoutes);
app.use('/api/exams', verifyToken, examsRoutes);
app.use('/api', verifyToken, importExportRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
