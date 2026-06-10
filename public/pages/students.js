async function renderStudents(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Студенты</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddStudentModal()">Добавить студента</button>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Группа</label><select id="groupFilter" onchange="renderStudents(document.getElementById(\'mainContent\'))"><option value="">Все</option></select></div>';
  html += '</div>';
  html += '<div id="studentsTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  try {
    const groups = await apiGet('/groups');
    const select = document.getElementById('groupFilter');
    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      select.appendChild(opt);
    });

    const groupId = select.value;
    const url = groupId ? `/students?group_id=${groupId}` : '/students';
    const students = await apiGet(url);

    const tbody = students.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.full_name}</td>
        <td>${s.group_id}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditStudentModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')">✎</button>
            <button class="btn btn-sm btn-outline" onclick="showTransferModal(${s.id})">Перевод</button>
            <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('studentsTable').innerHTML = students.length === 0
      ? '<p class="empty-state">Нет студентов</p>'
      : `<div class="table-container"><table>
          <thead><tr><th>ID</th><th>ФИО</th><th>Группа ID</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('studentsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddStudentModal() {
  loadStudentGroups().then(() => {
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
