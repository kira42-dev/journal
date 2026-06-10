async function renderReports(container) {
  const role = getRole();
  let html = '<h2>Отчёты</h2>';

  html += '<div class="tabs">';
  html += '<button class="tab active" data-report="performance" onclick="switchReport(this)">Успеваемость</button>';
  html += '<button class="tab" data-report="absences" onclick="switchReport(this)">Пропуски</button>';
  html += '<button class="tab" data-report="plan" onclick="switchReport(this)">Выполнение плана</button>';
  html += '<button class="tab" data-report="finalGrade" onclick="switchReport(this)">Итоговый балл</button>';
  html += '<button class="tab" data-report="debtors" onclick="switchReport(this)">Должники</button>';
  html += '</div>';

  html += '<div class="filters" id="reportFilters">';
  html += '<div class="filter-group"><label>Группа</label><select id="reportGroupFilter"><option value="">Выберите группу</option></select></div>';
  html += '<div class="filter-group"><label>Предмет</label><select id="reportSubjectFilter"><option value="">Выберите предмет</option></select></div>';
  html += '<button class="btn btn-primary" onclick="loadCurrentReport()">Сформировать</button>';
  html += '</div>';

  html += '<div id="reportResult"><p class="empty-state">Выберите параметры и нажмите "Сформировать"</p></div>';
  container.innerHTML = html;

  try {
    const groups = await apiGet('/groups');
    const subjects = await apiGet('/subjects');
    fillSelect('reportGroupFilter', groups, 'id', 'name');
    fillSelect('reportSubjectFilter', subjects, 'id', 'name');
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

let currentReportType = 'performance';

function switchReport(el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentReportType = el.dataset.report;
  loadCurrentReport();
}

async function loadCurrentReport() {
  const groupId = document.getElementById('reportGroupFilter')?.value;
  const subjectId = document.getElementById('reportSubjectFilter')?.value;
  const container = document.getElementById('reportResult');
  if (!groupId || !subjectId) {
    container.innerHTML = '<p class="empty-state">Выберите группу и предмет</p>';
    return;
  }

  try {
    switch (currentReportType) {
      case 'performance':
        await loadPerformanceReport(groupId, subjectId, container);
        break;
      case 'absences':
        await loadAbsencesReport(groupId, subjectId, container);
        break;
      case 'plan':
        await loadPlanReport(groupId, subjectId, container);
        break;
      case 'finalGrade':
        await loadFinalGradeReport(groupId, subjectId, container);
        break;
      case 'debtors':
        await loadDebtorsReport(groupId, subjectId, container);
        break;
    }
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки отчёта'}</p>`;
  }
}

async function loadPerformanceReport(groupId, subjectId, container) {
  const data = await apiGet(`/reports/performance?group_id=${groupId}&subject_id=${subjectId}`);

  let html = '<div class="table-container"><table><thead><tr><th>Студент</th>';
  data.lessons.forEach(l => {
    html += `<th>${l.date}<br><small>${l.topic || '—'}</small></th>`;
  });
  html += '</tr></thead><tbody>';

  data.students.forEach(s => {
    html += `<tr><td><strong>${s.full_name}</strong></td>`;
    data.lessons.forEach(l => {
      const g = s.grades.find(gr => gr.lesson_id === l.id);
      if (g) {
        html += `<td>${g.presence ? (g.grade !== null ? g.grade : '✔') : 'н'}</td>`;
      } else {
        html += '<td>—</td>';
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function loadAbsencesReport(groupId, subjectId, container) {
  const data = await apiGet(`/reports/absences?group_id=${groupId}&subject_id=${subjectId}`);

  const rows = data.map(s => `
    <tr>
      <td>${s.student_id}</td>
      <td>${s.full_name}</td>
      <td><strong>${s.absences}</strong></td>
    </tr>
  `).join('');

  container.innerHTML = data.length === 0
    ? '<p class="empty-state">Нет данных</p>'
    : `<div class="table-container"><table>
        <thead><tr><th>ID</th><th>Студент</th><th>Пропуски</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
}

async function loadPlanReport(groupId, subjectId, container) {
  const data = await apiGet(`/reports/plan-completion?group_id=${groupId}&subject_id=${subjectId}`);

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${data.percent.lecture}%</div>
        <div class="stat-label">Лекции</div>
        <div style="font-size:0.8rem;color:var(--text-secondary)">${data.conducted.lecture} / ${data.planned.lecture} ч</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.percent.practice}%</div>
        <div class="stat-label">Практика</div>
        <div style="font-size:0.8rem;color:var(--text-secondary)">${data.conducted.practice} / ${data.planned.practice} ч</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.percent.total}%</div>
        <div class="stat-label">Всего</div>
        <div style="font-size:0.8rem;color:var(--text-secondary)">${data.conducted.total} / ${data.planned.total} ч</div>
      </div>
    </div>
  `;
}

async function loadFinalGradeReport(groupId, subjectId, container) {
  const students = await apiGet(`/students?group_id=${groupId}`);

  const rows = [];
  for (const s of students) {
    try {
      const grade = await apiGet(`/reports/student-final-grade?student_id=${s.id}&subject_id=${subjectId}`);
      rows.push(grade);
    } catch { }
  }

  const tbody = rows.map(r => `
    <tr>
      <td>${r.student_id}</td>
      <td>${r.full_name}</td>
      <td><strong>${r.avg_grade !== null ? r.avg_grade : '—'}</strong></td>
      <td>${r.total_grades}</td>
      <td>${r.absences}</td>
    </tr>
  `).join('');

  container.innerHTML = rows.length === 0
    ? '<p class="empty-state">Нет данных</p>'
    : `<div class="table-container"><table>
        <thead><tr><th>ID</th><th>Студент</th><th>Средний балл</th><th>Оценок</th><th>Пропуски</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table></div>`;
}

async function loadDebtorsReport(groupId, subjectId, container) {
  const data = await apiGet(`/reports/debtors?group_id=${groupId}`);

  const tbody = data.map(d => `
    <tr>
      <td>${d.student_id}</td>
      <td>${d.full_name}</td>
      <td>${d.avg_grade}</td>
      <td>${d.absences}</td>
    </tr>
  `).join('');

  container.innerHTML = data.length === 0
    ? '<p class="empty-state">Должников нет</p>'
    : `<div class="table-container"><table>
        <thead><tr><th>ID</th><th>Студент</th><th>Средний балл</th><th>Пропуски</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table></div>`;
}
