async function renderStudents(container) {
  const prevGroupId = document.getElementById('groupFilter')?.value || '';
  const role = getRole();
  let html = '<div class="toolbar"><h2>Студенты</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddStudentModal()">Добавить студента</button>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Группа</label><select id="groupFilter"><option value="">Все</option></select></div>';
  html += '</div>';
  html += '<div id="studentsTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  document.getElementById('groupFilter').addEventListener('change', loadStudentsTable);
  await loadStudentsTable(prevGroupId);
}

async function loadStudentsTable(defaultVal) {
  const select = document.getElementById('groupFilter');
  try {
    const groups = await apiGet('/groups');
    const currentVal = select.value || defaultVal || '';
    groups.forEach(g => {
      if (!select.querySelector(`option[value="${g.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
      }
    });
    select.value = currentVal;

    const groupMap = {};
    groups.forEach(g => { groupMap[g.id] = g.name; });

    const groupId = select.value;
    const url = groupId ? `/students?group_id=${groupId}` : '/students';
    const role = getRole();
    const students = await apiGet(url);

    const tbody = students.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.full_name}</td>
        <td>${groupMap[s.group_id] || s.group_id}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditStudentModal(${escapeAttr(s.id)}, '${escapeAttr(s.full_name)}')">✎</button>
            <button class="btn btn-sm btn-outline" onclick="showTransferModal(${escapeAttr(s.id)})">Перевод</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent(${escapeAttr(s.id)})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('studentsTable').innerHTML = students.length === 0
      ? '<p class="empty-state">Нет студентов</p>'
      : `<div class="table-container"><table>
          <thead><tr><th>ID</th><th>ФИО</th><th>Группа</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('studentsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddStudentModal() {
  createModal('studentModal', 'Добавить студента', `
    <form id="studentForm">
      <div class="form-group">
        <label>ФИО</label>
        <input type="text" id="stName" required>
      </div>
      <div class="form-group">
        <label>Группа</label>
        <select id="stGroupId" required></select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('studentModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('studentModal');
  loadStudentGroups();

  document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      full_name: document.getElementById('stName').value.trim(),
      group_id: Number(document.getElementById('stGroupId').value)
    };
    if (!data.full_name) return;
    try {
      await apiPost('/students', data);
      closeModal('studentModal');
      renderStudents(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditStudentModal(id, currentName) {
  createModal('studentModal', 'Редактировать студента', `
    <form id="studentForm">
      <div class="form-group">
        <label>ФИО</label>
        <input type="text" id="stName" value="${currentName}" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('studentModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('studentModal');

  document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPut(`/students/${id}`, { full_name: document.getElementById('stName').value.trim() });
      closeModal('studentModal');
      renderStudents(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function showTransferModal(studentId) {
  try {
    const groups = await apiGet('/groups');
    createModal('transferModal', 'Перевод в другую группу', `
      <form id="transferForm">
        <div class="form-group">
          <label>Новая группа</label>
          <select id="newGroupId" required>
            ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('transferModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Перевести</button>
        </div>
      </form>
    `);
    openModal('transferModal');

    document.getElementById('transferForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiPut(`/students/${studentId}/transfer`, { new_group_id: Number(document.getElementById('newGroupId').value) });
        closeModal('transferModal');
        renderStudents(document.getElementById('mainContent'));
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}

async function loadStudentGroups() {
  const groups = await apiGet('/groups');
  const sel = document.getElementById('stGroupId');
  if (sel) {
    sel.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }
}

async function deleteStudent(id) {
  if (!confirm('Отчислить студента? Это также удалит учётную запись старосты, если она есть.')) return;
  try {
    await apiDelete(`/students/${id}`);
    renderStudents(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
