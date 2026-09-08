async function renderGrades(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Журнал оценок</h2></div>';

  // Tabs
  html += '<div class="tabs" id="gradesTabs">';
  html += '<button class="tab active" data-grade-tab="matrix" onclick="switchGradeTab(\'matrix\')">Сводная таблица</button>';
  html += '<button class="tab" data-grade-tab="lesson" onclick="switchGradeTab(\'lesson\')">По занятию</button>';
  html += '</div>';

  // Filters
  html += '<div class="filters" style="margin: 16px 0;">';

  if (role === 'teacher') {
    html += '<div class="filter-group"><label>Группа</label><select id="groupFilter" onchange="onGradeFilterChange()"><option value="">Выберите группу</option></select></div>';
  } else {
    html += '<div class="filter-group"><label>Группа</label><select id="groupFilter" style="display:none"></select><span id="groupLabel" class="text-secondary"></span></div>';
  }

  html += '<div class="filter-group"><label>Предмет</label><select id="subjectFilter" onchange="onGradeFilterChange()"><option value="">Выберите предмет</option></select></div>';
  html += '<div class="filter-group"><label>Занятие</label><select id="lessonFilter" onchange="loadGradeTable()"><option value="">Выберите занятие</option></select></div>';
  html += '</div>';

  html += '<div id="gradeTable"></div>';
  container.innerHTML = html;

  try {
    const groups = await apiGet('/groups');
    const subjects = await apiGet('/subjects');
    fillSelect('groupFilter', groups, 'id', 'name');
    fillSelect('subjectFilter', subjects, 'id', 'name');

    if (role === 'headman' && groups.length > 0) {
      const groupLabel = document.getElementById('groupLabel');
      if (groupLabel) groupLabel.textContent = 'Группа: ' + groups[0].name;
      document.getElementById('groupFilter').value = groups[0].id;
    }
    onGradeFilterChange();
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function getActiveGradeTab() {
  const active = document.querySelector('#gradesTabs .tab.active');
  return active ? active.dataset.gradeTab : 'matrix';
}

function switchGradeTab(tab) {
  document.querySelectorAll('#gradesTabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.gradeTab === tab)
  );
  const lessonF = document.getElementById('lessonFilter');
  if (lessonF) lessonF.closest('.filter-group').style.display = tab === 'matrix' ? 'none' : '';
  onGradeFilterChange();
}

function onGradeFilterChange() {
  const tab = getActiveGradeTab();
  const lessonF = document.getElementById('lessonFilter');
  if (lessonF) lessonF.closest('.filter-group').style.display = tab === 'matrix' ? 'none' : '';
  if (tab === 'matrix') {
    loadGradebookMatrix();
  } else {
    loadLessonsForGrades();
  }
}

// ============ СВОДНАЯ ТАБЛИЦА (matrix, inline editing) ============

async function loadGradebookMatrix() {
  const groupId = document.getElementById('groupFilter')?.value;
  const subjectId = document.getElementById('subjectFilter')?.value;
  const container = document.getElementById('gradeTable');
  const role = getRole();

  if (!groupId || !subjectId) {
    container.innerHTML = '<p class="empty-state">Выберите группу и предмет</p>';
    return;
  }

  try {
    const data = await apiGet(`/reports/gradebook?group_id=${groupId}&subject_id=${subjectId}`);

    if (data.lessons.length === 0) {
      container.innerHTML = '<p class="empty-state">По этому предмету в данной группе нет занятий. Сначала создайте занятие в разделе «Занятия».</p>';
      return;
    }

    let html = `<div class="card"><h3>${data.subject.name} — ${data.group.name} (${data.subject.course} курс, ${data.subject.semester} семестр)</h3>`;
    html += `<p class="text-secondary" style="padding:0">Форма контроля: ${data.subject.assessment_type === 'exam' ? 'Экзамен' : 'Зачёт'}</p></div>`;

    html += `<div class="gb-wrapper"><table class="gb-table">
      <thead><tr>
        <th class="gb-sticky-col gb-name-col">Студент</th>`;

    data.lessons.forEach(l => {
      html += `<th class="gb-lesson-col">
        <div class="gb-date">${l.date}</div>
        <div class="gb-topic">${l.topic || ''}</div>
        <div class="gb-sub">${l.type === 'lecture' ? 'Лекция' : 'Практика'} · ${l.hours}ч</div>
      </th>`;
    });

    html += '</tr></thead><tbody>';

    data.students.forEach(s => {
      html += `<tr>
        <td class="gb-sticky-col gb-name-col">${s.full_name}</td>`;
      data.lessons.forEach((l, idx) => {
        html += renderGradeCell(s.student_id, l.id, s.grades[idx], role);
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    html += '<p class="text-secondary gb-hint">Выберите оценку, отметьте отсутствие (НБ) или введите комментарий в ячейке. Сохранение автоматическое.</p>';

    container.innerHTML = html;
    attachGradebookEvents();
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function renderGradeCell(studentId, lessonId, cell, role) {
  const isTeacher = role === 'teacher';
  const presence = cell ? cell.presence : 1;
  const grade = cell ? cell.grade : null;
  const comment = cell ? (cell.comment || '') : '';

  let html = `<td class="gb-cell" data-sid="${studentId}" data-lid="${lessonId}">`;
  html += '<div class="gb-controls">';
  html += `<button type="button" class="gb-presence ${presence === 0 ? 'absent' : ''}" title="Присутствие / НБ">${presence === 0 ? 'НБ' : '✓'}</button>`;
  if (isTeacher) {
    html += '<select class="gb-grade"><option value="">—</option>';
    [5, 4, 3, 2].forEach(v => {
      html += `<option value="${v}" ${grade === v ? 'selected' : ''} class="g-g${v}">${v}</option>`;
    });
    html += '</select>';
    html += `<input type="text" class="gb-comment" value="${escapeAttr(comment)}" placeholder="коммент." maxlength="200">`;
  } else {
    html += `<span class="gb-grade-readonly ${grade ? 'g-g' + grade : ''}">${grade !== null && grade !== undefined ? grade : (presence === 0 ? 'НБ' : '')}</span>`;
  }
  html += '</div></td>';
  return html;
}

// Attach inline-editing handlers. We keep a per-cell save queue.
function attachGradebookEvents() {
  document.querySelectorAll('.gb-table .gb-cell').forEach(cell => {
    // Presence toggle
    const presenceBtn = cell.querySelector('.gb-presence');
    if (presenceBtn) {
      presenceBtn.addEventListener('click', () => {
        const isAbsent = presenceBtn.classList.contains('absent');
        presenceBtn.classList.toggle('absent', !isAbsent);
        presenceBtn.textContent = isAbsent ? '✓' : 'НБ';
        queueCellSave(cell);
      });
    }
    // Grade select
    const gradeSel = cell.querySelector('.gb-grade');
    if (gradeSel) {
      gradeSel.addEventListener('change', () => queueCellSave(cell));
    }
    // Comment input (debounced save)
    const commentInput = cell.querySelector('.gb-comment');
    if (commentInput) {
      const doSave = () => queueCellSave(cell);
      commentInput.addEventListener('change', doSave);
      commentInput.addEventListener('blur', doSave);
    }
  });
}

let gbSaveTimer = null;
let gbPending = new Map();

function queueCellSave(cell) {
  const sid = Number(cell.dataset.sid);
  const lid = Number(cell.dataset.lid);
  if (!sid || !lid) return;

  const presenceBtn = cell.querySelector('.gb-presence');
  const gradeSel = cell.querySelector('.gb-grade');
  const commentInput = cell.querySelector('.gb-comment');

  const item = {
    lesson_id: lid,
    student_id: sid,
    presence: presenceBtn && presenceBtn.classList.contains('absent') ? 0 : 1,
    grade: gradeSel && gradeSel.value ? Number(gradeSel.value) : null,
    comment: commentInput ? (commentInput.value.trim() || null) : null
  };

  gbPending.set(`${sid}:${lid}`, item);

  if (gbSaveTimer) clearTimeout(gbSaveTimer);
  gbSaveTimer = setTimeout(savePendingGradebook, 600);
}

async function savePendingGradebook() {
  if (gbPending.size === 0) return;
  const items = Array.from(gbPending.values());
  gbPending = new Map();

  // visual saving indicator
  const hint = document.querySelector('.gb-hint');
  if (hint) hint.textContent = 'Сохранение...';

  try {
    const res = await apiFetch('/grades/bulk', { method: 'POST', body: JSON.stringify({ items }) });
    const data = await res.json();
    if (data.errors && data.errors.length) {
      alert('Ошибки при сохранении:\n' + data.errors.join('\n'));
    }
    if (hint) hint.textContent = 'Кликните в ячейку, чтобы изменить оценку, НБ или комментарий. Сохранение автоматическое.';
  } catch (err) {
    if (hint) hint.textContent = 'Ошибка сохранения!';
    alert(err.error || 'Ошибка сохранения');
  }
}

// ============ ПО ЗАНЯТИЮ (existing single-lesson view) ============

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
      document.getElementById('gradeTable').innerHTML = '<p class="empty-state">По выбранным группе и предмету занятий нет</p>';
      return;
    }
    if (!select.value) {
      // auto-select first lesson for convenience
      select.value = select.options[1].value;
      loadGradeTable();
    } else {
      loadGradeTable();
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
            <button class="btn btn-sm btn-outline" onclick="showEditGradeModal(${g.id}, ${g.student_id}, ${g.presence}, ${g.grade !== null ? g.grade : 'null'}, '${escapeAttr(g.comment || '')}')">✎</button>
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
  const groupId = document.getElementById('groupFilter').value;
  if (!groupId) { alert('Группа не выбрана'); return; }
  apiGet(`/students?group_id=${groupId}`).then(students => {
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