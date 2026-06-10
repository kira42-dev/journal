async function renderSubjects(container) {
  const prevCollegeId = document.getElementById('collegeFilter')?.value || '';
  const role = getRole();
  let html = '<div class="toolbar"><h2>Предметы</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddSubjectModal()">Добавить предмет</button>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Колледж</label><select id="collegeFilter"><option value="">Все</option></select></div>';
  html += '</div>';

  html += '<div id="subjectsTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  document.getElementById('collegeFilter').addEventListener('change', loadSubjectsTable);
  await loadSubjectsTable(prevCollegeId);
}

async function loadSubjectsTable(defaultVal) {
  const select = document.getElementById('collegeFilter');
  try {
    const colleges = await apiGet('/colleges');
    const currentVal = select.value || defaultVal || '';
    colleges.forEach(c => {
      if (!select.querySelector(`option[value="${c.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      }
    });
    select.value = currentVal;

    const collegeMap = {};
    colleges.forEach(c => { collegeMap[c.id] = c.name; });

    const collegeId = select.value;
    const url = collegeId ? `/subjects?college_id=${collegeId}` : '/subjects';
    const role = getRole();
    const subjects = await apiGet(url);

    const tbody = subjects.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${collegeMap[s.college_id] || s.college_id}</td>
        <td>${s.lecture_hours}</td>
        <td>${s.practice_hours}</td>
        <td>${s.total_hours}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditSubjectModal(${escapeAttr(s.id)})">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSubject(${escapeAttr(s.id)})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('subjectsTable').innerHTML = subjects.length === 0
      ? '<p class="empty-state">Нет предметов</p>'
      : `<div class="table-container"><table>
          <thead><tr>
            <th>ID</th><th>Название</th><th>Колледж</th><th>Лекции (ч)</th><th>Практика (ч)</th><th>Всего (ч)</th><th>Действия</th>
          </tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('subjectsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddSubjectModal() {
  createModal('subjectModal', 'Добавить предмет', `
    <form id="subjectForm">
      <div class="form-group">
        <label>Колледж</label>
        <select id="sCollegeId" required></select>
      </div>
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="sName" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Лекции (часы)</label>
          <input type="number" id="sLecture" value="0" min="0">
        </div>
        <div class="form-group">
          <label>Практика (часы)</label>
          <input type="number" id="sPractice" value="0" min="0">
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('subjectModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('subjectModal');
  loadCollegeSelect();

  document.getElementById('subjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      college_id: Number(document.getElementById('sCollegeId').value),
      name: document.getElementById('sName').value.trim(),
      lecture_hours: Number(document.getElementById('sLecture').value),
      practice_hours: Number(document.getElementById('sPractice').value)
    };
    if (!data.name) return;
    try {
      await apiPost('/subjects', data);
      closeModal('subjectModal');
      renderSubjects(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function showEditSubjectModal(id) {
  try {
    const subject = await apiGet(`/subjects/${id}`);
    createModal('subjectModal', 'Редактировать предмет', `
      <form id="subjectForm">
        <div class="form-group">
          <label>Колледж</label>
          <select id="sCollegeId" required></select>
        </div>
        <div class="form-group">
          <label>Название</label>
          <input type="text" id="sName" value="${subject.name}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Лекции (часы)</label>
            <input type="number" id="sLecture" value="${subject.lecture_hours}" min="0">
          </div>
          <div class="form-group">
            <label>Практика (часы)</label>
            <input type="number" id="sPractice" value="${subject.practice_hours}" min="0">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('subjectModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('subjectModal');
    await loadCollegeSelect();
    document.getElementById('sCollegeId').value = subject.college_id;

    document.getElementById('subjectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        college_id: Number(document.getElementById('sCollegeId').value),
        name: document.getElementById('sName').value.trim(),
        lecture_hours: Number(document.getElementById('sLecture').value),
        practice_hours: Number(document.getElementById('sPractice').value)
      };
      if (!data.name) return;
      try {
        await apiPut(`/subjects/${id}`, data);
        closeModal('subjectModal');
        renderSubjects(document.getElementById('mainContent'));
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}

async function loadCollegeSelect() {
  const colleges = await apiGet('/colleges');
  const selects = document.querySelectorAll('#sCollegeId');
  selects.forEach(sel => {
    sel.innerHTML = colleges.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  });
}

async function deleteSubject(id) {
  if (!confirm('Удалить предмет? Это удалит все связанные темы и занятия.')) return;
  try {
    await apiDelete(`/subjects/${id}`);
    renderSubjects(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
