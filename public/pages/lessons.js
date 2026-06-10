async function renderLessons(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Занятия</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddLessonModal()">Добавить занятие</button>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Группа</label><select id="groupFilter" onchange="renderLessons(document.getElementById(\'mainContent\'))"><option value="">Все</option></select></div>';
  html += '<div class="filter-group"><label>Предмет</label><select id="subjectFilter" onchange="renderLessons(document.getElementById(\'mainContent\'))"><option value="">Все</option></select></div>';
  html += '<div class="filter-group"><label>Дата</label><input type="date" id="dateFilter" onchange="renderLessons(document.getElementById(\'mainContent\'))"></div>';
  html += '<div class="filter-group"><label>Тип</label><select id="typeFilter" onchange="renderLessons(document.getElementById(\'mainContent\'))"><option value="">Все</option><option value="lecture">Лекция</option><option value="practice">Практика</option></select></div>';
  html += '</div>';

  html += '<div id="hoursRemaining"></div>';
  html += '<div id="lessonsTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  try {
    const groups = await apiGet('/groups');
    const subjects = await apiGet('/subjects');

    fillSelect('groupFilter', groups, 'id', 'name');
    fillSelect('subjectFilter', subjects, 'id', 'name');

    const params = new URLSearchParams();
    const gId = document.getElementById('groupFilter').value;
    const sId = document.getElementById('subjectFilter').value;
    const date = document.getElementById('dateFilter').value;
    const type = document.getElementById('typeFilter').value;
    if (gId) params.set('group_id', gId);
    if (sId) params.set('subject_id', sId);
    if (date) params.set('date', date);
    if (type) params.set('lesson_type', type);

    const qs = params.toString();
    const lessons = await apiGet('/lessons' + (qs ? '?' + qs : ''));

    if (gId && sId) {
      loadHoursRemaining(gId, sId);
    }

    const tbody = lessons.map(l => `
      <tr>
        <td>${l.id}</td>
        <td>${l.group_name}</td>
        <td>${l.subject_name}</td>
        <td>${l.topic_name || '—'}</td>
        <td>${l.lesson_date}</td>
        <td>${l.hours}</td>
        <td>${l.lesson_type === 'lecture' ? 'Лекция' : 'Практика'}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditLessonModal(${l.id})">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteLesson(${l.id})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('lessonsTable').innerHTML = lessons.length === 0
      ? '<p class="empty-state">Нет занятий</p>'
      : `<div class="table-container" id="lessonsTableInner"><table>
          <thead><tr>
            <th>ID</th><th>Группа</th><th>Предмет</th><th>Тема</th><th>Дата</th><th>Часы</th><th>Тип</th><th>Действия</th>
          </tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
    enableTableSort('lessonsTableInner');
  } catch (err) {
    document.getElementById('lessonsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

async function loadHoursRemaining(groupId, subjectId) {
  try {
    const data = await apiGet(`/lessons/hours-remaining?group_id=${groupId}&subject_id=${subjectId}`);
    document.getElementById('hoursRemaining').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${data.remaining.lecture}</div>
          <div class="stat-label">Осталось лекций (ч)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.remaining.practice}</div>
          <div class="stat-label">Осталось практики (ч)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.planned.lecture}</div>
          <div class="stat-label">Запланировано лекций</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.planned.practice}</div>
          <div class="stat-label">Запланировано практики</div>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('hoursRemaining').innerHTML = '';
  }
}

function showAddLessonModal() {
  createModal('lessonModal', 'Добавить занятие', `
    <form id="lessonForm">
      <div class="form-group">
        <label>Группа</label>
        <select id="lGroupId" required></select>
      </div>
      <div class="form-group">
        <label>Предмет</label>
        <select id="lSubjectId" required onchange="loadLessonTopics()"></select>
      </div>
      <div class="form-group">
        <label>Тема</label>
        <select id="lTopicId"><option value="">— Без темы —</option></select>
      </div>
      <div class="form-group">
        <label>Дата</label>
        <input type="date" id="lDate" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Часы</label>
          <input type="number" id="lHours" step="0.5" min="0.5" required>
        </div>
        <div class="form-group">
          <label>Тип</label>
          <select id="lType" required>
            <option value="lecture">Лекция</option>
            <option value="practice">Практика</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('lessonModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('lessonModal');

  Promise.all([apiGet('/groups'), apiGet('/subjects')]).then(([groups, subjects]) => {
    fillSelect('lGroupId', groups, 'id', 'name');
    fillSelect('lSubjectId', subjects, 'id', 'name');
  });

  document.getElementById('lessonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      group_id: Number(document.getElementById('lGroupId').value),
      subject_id: Number(document.getElementById('lSubjectId').value),
      topic_id: document.getElementById('lTopicId').value ? Number(document.getElementById('lTopicId').value) : null,
      lesson_date: document.getElementById('lDate').value,
      hours: Number(document.getElementById('lHours').value),
      lesson_type: document.getElementById('lType').value
    };
    if (!data.group_id || !data.subject_id || !data.lesson_date || !data.hours) return;
    try {
      await apiPost('/lessons', data);
      closeModal('lessonModal');
      renderLessons(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditLessonModal(id) {
  apiGet(`/lessons/${id}`).then(lesson => {
    createModal('lessonModal', 'Редактировать занятие', `
      <form id="lessonForm">
        <div class="form-group">
          <label>Группа</label>
          <select id="lGroupId" required></select>
        </div>
        <div class="form-group">
          <label>Предмет</label>
          <select id="lSubjectId" required onchange="loadLessonTopics()"></select>
        </div>
        <div class="form-group">
          <label>Тема</label>
          <select id="lTopicId"><option value="">— Без темы —</option></select>
        </div>
        <div class="form-group">
          <label>Дата</label>
          <input type="date" id="lDate" value="${lesson.lesson_date}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Часы</label>
            <input type="number" id="lHours" step="0.5" min="0.5" value="${lesson.hours}" required>
          </div>
          <div class="form-group">
            <label>Тип</label>
            <select id="lType" required>
              <option value="lecture" ${lesson.lesson_type === 'lecture' ? 'selected' : ''}>Лекция</option>
              <option value="practice" ${lesson.lesson_type === 'practice' ? 'selected' : ''}>Практика</option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('lessonModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('lessonModal');

    Promise.all([apiGet('/groups'), apiGet('/subjects')]).then(([groups, subjects]) => {
      fillSelect('lGroupId', groups, 'id', 'name');
      fillSelect('lSubjectId', subjects, 'id', 'name');
      document.getElementById('lGroupId').value = lesson.group_id;
      document.getElementById('lSubjectId').value = lesson.subject_id;
      loadLessonTopics().then(() => {
        if (lesson.topic_id) document.getElementById('lTopicId').value = lesson.topic_id;
      });
    });

    document.getElementById('lessonForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        group_id: Number(document.getElementById('lGroupId').value),
        subject_id: Number(document.getElementById('lSubjectId').value),
        topic_id: document.getElementById('lTopicId').value ? Number(document.getElementById('lTopicId').value) : null,
        lesson_date: document.getElementById('lDate').value,
        hours: Number(document.getElementById('lHours').value),
        lesson_type: document.getElementById('lType').value
      };
      try {
        await apiPut(`/lessons/${id}`, data);
        closeModal('lessonModal');
        renderLessons(document.getElementById('mainContent'));
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  }).catch(err => alert(err.error || 'Ошибка'));
}

async function loadLessonTopics() {
  const subjectId = document.getElementById('lSubjectId')?.value;
  const select = document.getElementById('lTopicId');
  if (!select) return;
  if (!subjectId) {
    select.innerHTML = '<option value="">— Без темы —</option>';
    return;
  }
  try {
    const topics = await apiGet(`/topics?subject_id=${subjectId}`);
    select.innerHTML = '<option value="">— Без темы —</option>' +
      topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  } catch {
    select.innerHTML = '<option value="">— Без темы —</option>';
  }
}

function fillSelect(id, items, valueKey, labelKey) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = sel.querySelector('option[value=""]') ? '<option value="">—</option>' : '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
}

async function deleteLesson(id) {
  if (!confirm('Удалить занятие? Все оценки будут удалены.')) return;
  try {
    await apiDelete(`/lessons/${id}`);
    renderLessons(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
