async function renderGrades(container) {
  const role = getRole();
  let html = '<h2>Журнал оценок</h2>';

  html += '<div class="filters" style="margin: 16px 0;">';
  html += '<div class="filter-group"><label>Группа</label><select id="groupFilter" onchange="loadLessonsForGrades()"><option value="">Выберите группу</option></select></div>';
  html += '<div class="filter-group"><label>Предмет</label><select id="subjectFilter" onchange="loadLessonsForGrades()"><option value="">Выберите предмет</option></select></div>';
  html += '<div class="filter-group"><label>Занятие</label><select id="lessonFilter" onchange="loadGradeTable()"><option value="">Выберите занятие</option></select></div>';
  html += '</div>';

  html += '<div id="gradeTable"><p class="empty-state">Выберите занятие для просмотра оценок</p></div>';
  container.innerHTML = html;

  try {
    const groups = await apiGet('/groups');
    const subjects = await apiGet('/subjects');
    fillSelect('groupFilter', groups, 'id', 'name');
    fillSelect('subjectFilter', subjects, 'id', 'name');
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

async function loadLessonsForGrades() {
  const groupId = document.getElementById('groupFilter').value;
  const subjectId = document.getElementById('subjectFilter').value;
  const select = document.getElementById('lessonFilter');
  select.innerHTML = '<option value="">Загрузка...</option>';

  if (!groupId || !subjectId) {
    select.innerHTML = '<option value="">Выберите группу и предмет</option>';
    document.getElementById('gradeTable').innerHTML = '<p class="empty-state">Выберите занятие для просмотра оценок</p>';
    return;
  }

  try {
    const lessons = await apiGet(`/lessons?group_id=${groupId}&subject_id=${subjectId}`);
    select.innerHTML = '<option value="">— Выберите занятие —</option>' +
      lessons.map(l => `<option value="${l.id}">${l.lesson_date} — ${l.subject_name} (${l.hours}ч, ${l.lesson_type === 'lecture' ? 'Лекция' : 'Практика'})${l.topic_name ? ' — ' + l.topic_name : ''}</option>`).join('');
    if (lessons.length === 0) {
      select.innerHTML = '<option value="">Нет занятий</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="">Ошибка загрузки</option>';
  }
}

async function loadGradeTable() {
  const lessonId = document.getElementById('lessonFilter').value;
  const container = document.getElementById('gradeTable');
  if (!lessonId) {
    container.innerHTML = '<p class="empty-state">Выберите занятие для просмотра оценок</p>';
    return;
  }

  try {
    const lesson = await apiGet(`/lessons/${lessonId}`);
    const grades = lesson.grades || [];

    let html = `<div class="card"><h3>Занятие: ${lesson.lesson_date} — ${lesson.subject_name} (${lesson.hours}ч, ${lesson.lesson_type === 'lecture' ? 'Лекция' : 'Практика'})</h3>`;
    if (lesson.topic_name) html += `<p>Тема: ${lesson.topic_name}</p>`;
    html += '</div>';

    const role = getRole();
    html += `<div class="table-container"><table>
      <thead><tr>
        <th>Студент</th>
        <th>Присутствие</th>
        <th>Оценка</th>
        ${role === 'teacher' ? '<th>Комментарий</th>' : ''}
        <th>Действия</th>
      </tr></thead>
      <tbody>`;

    html += grades.map(g => `
      <tr>
        <td>${g.full_name}</td>
        <td>${g.presence ? '✔' : '✘'}</td>
        <td>${g.grade !== null ? g.grade : '—'}</td>
        ${role === 'teacher' ? `<td>${g.comment || ''}</td>` : ''}
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditGradeModal(${g.id}, ${g.student_id}, ${g.presence}, ${g.grade !== null ? g.grade : 'null'}, '${(g.comment || '').replace(/'/g, "\\'")}')">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteGrade(${g.id})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    html += '</tbody></table></div>';

    if (role === 'teacher') {
      const groupId = document.getElementById('groupFilter').value;
      html += `<div style="margin-top: 16px;"><button class="btn btn-primary" onclick="showAddGradeModal(${lessonId}, ${groupId})">Добавить оценку</button></div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddGradeModal(lessonId, groupId) {
  apiGet(`/students?group_id=${groupId}`).then(students => {
    createModal('gradeModal', 'Добавить оценку', `
      <form id="gradeForm">
        <div class="form-group">
          <label>Студент</label>
          <select id="gStudentId" required>
            ${students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Присутствие</label>
            <select id="gPresence">
              <option value="1">Присутствовал</option>
              <option value="0">Отсутствовал</option>
            </select>
          </div>
          <div class="form-group">
            <label>Оценка</label>
            <select id="gGrade">
              <option value="">— Не ставить —</option>
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Комментарий</label>
          <textarea id="gComment" rows="2"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('gradeModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('gradeModal');

    document.getElementById('gradeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gradeVal = document.getElementById('gGrade').value;
      const data = {
        lesson_id: lessonId,
        student_id: Number(document.getElementById('gStudentId').value),
        presence: Number(document.getElementById('gPresence').value),
        grade: gradeVal ? Number(gradeVal) : null,
        comment: document.getElementById('gComment').value.trim() || null
      };
      try {
        await apiPost('/grades', data);
        closeModal('gradeModal');
        loadGradeTable();
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  }).catch(err => alert(err.error || 'Ошибка'));
}

function showEditGradeModal(id, studentId, presence, grade, comment) {
  apiGet(`/students?group_id=`).then(students => {
    createModal('gradeModal', 'Редактировать оценку', `
      <form id="gradeForm">
        <div class="form-row">
          <div class="form-group">
            <label>Присутствие</label>
            <select id="gPresence">
              <option value="1" ${presence === 1 ? 'selected' : ''}>Присутствовал</option>
              <option value="0" ${presence === 0 ? 'selected' : ''}>Отсутствовал</option>
            </select>
          </div>
          <div class="form-group">
            <label>Оценка</label>
            <select id="gGrade">
              <option value="">— Не ставить —</option>
              <option value="5" ${grade === 5 ? 'selected' : ''}>5</option>
              <option value="4" ${grade === 4 ? 'selected' : ''}>4</option>
              <option value="3" ${grade === 3 ? 'selected' : ''}>3</option>
              <option value="2" ${grade === 2 ? 'selected' : ''}>2</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Комментарий</label>
          <textarea id="gComment" rows="2">${comment || ''}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('gradeModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('gradeModal');

    document.getElementById('gradeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gradeVal = document.getElementById('gGrade').value;
      const data = {
        presence: Number(document.getElementById('gPresence').value),
        grade: gradeVal ? Number(gradeVal) : null,
        comment: document.getElementById('gComment').value.trim() || null
      };
      try {
        await apiPut(`/grades/${id}`, data);
        closeModal('gradeModal');
        loadGradeTable();
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  }).catch(err => alert(err.error || 'Ошибка'));
}

async function deleteGrade(id) {
  if (!confirm('Удалить запись об оценке?')) return;
  try {
    await apiDelete(`/grades/${id}`);
    loadGradeTable();
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
