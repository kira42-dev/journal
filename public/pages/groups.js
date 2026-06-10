async function renderGroups(container) {
  const prevCollegeId = document.getElementById('collegeFilter')?.value || '';
  const role = getRole();
  let html = '<div class="toolbar"><h2>Группы</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddGroupModal()">Добавить группу</button>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Колледж</label><select id="collegeFilter"><option value="">Все</option></select></div>';
  html += '</div>';

  html += '<div id="groupsTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  document.getElementById('collegeFilter').addEventListener('change', loadGroupsTable);
  await loadGroupsTable(prevCollegeId);
}

async function loadGroupsTable(defaultVal) {
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

    const collegeId = select.value;
    const url = collegeId ? `/groups?college_id=${collegeId}` : '/groups';
    const role = getRole();
    const groups = await apiGet(url);

    const tbody = groups.map(g => `
      <tr>
        <td>${g.id}</td>
        <td>${g.name}</td>
        <td>${g.headman_name || '—'}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditGroupModal(${escapeAttr(g.id)}, '${escapeAttr(g.name)}')">✎</button>
            <button class="btn btn-sm btn-outline" onclick="showSetHeadmanModal(${escapeAttr(g.id)})">Назначить старосту</button>
            <button class="btn btn-sm btn-danger" onclick="deleteGroup(${escapeAttr(g.id)})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('groupsTable').innerHTML = groups.length === 0
      ? '<p class="empty-state">Нет групп</p>'
      : `<div class="table-container"><table>
          <thead><tr><th>ID</th><th>Название</th><th>Староста</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('groupsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddGroupModal() {
  createModal('groupModal', 'Добавить группу', `
    <form id="groupForm">
      <div class="form-group">
        <label>Колледж</label>
        <select id="gCollegeId" required></select>
      </div>
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="gName" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('groupModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('groupModal');
  loadGroupCollegeSelect();

  document.getElementById('groupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      college_id: Number(document.getElementById('gCollegeId').value),
      name: document.getElementById('gName').value.trim()
    };
    if (!data.name) return;
    try {
      await apiPost('/groups', data);
      closeModal('groupModal');
      renderGroups(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditGroupModal(id, currentName) {
  createModal('groupModal', 'Редактировать группу', `
    <form id="groupForm">
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="gName" value="${currentName}" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('groupModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('groupModal');

  document.getElementById('groupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPut(`/groups/${id}`, { name: document.getElementById('gName').value.trim() });
      closeModal('groupModal');
      renderGroups(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function showSetHeadmanModal(groupId) {
  try {
    const group = await apiGet(`/groups/${groupId}`);
    const students = group.students || [];

    createModal('headmanModal', 'Назначить старосту', `
      <form id="headmanForm">
        <div class="form-group">
          <label>Староста</label>
          <select id="hStudentId">
            <option value="">— Не назначать —</option>
            ${students.map(s => `<option value="${s.id}"${group.headman_id === s.id ? ' selected' : ''}>${s.full_name}</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('headmanModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('headmanModal');

    document.getElementById('headmanForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = document.getElementById('hStudentId').value;
      try {
        await apiPut(`/groups/${groupId}/headman`, { headman_id: val ? Number(val) : null });
        closeModal('headmanModal');
        renderGroups(document.getElementById('mainContent'));
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}

async function loadGroupCollegeSelect() {
  const colleges = await apiGet('/colleges');
  const sel = document.getElementById('gCollegeId');
  if (sel) {
    sel.innerHTML = colleges.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

async function deleteGroup(id) {
  if (!confirm('Удалить группу? Это удалит всех студентов и связанные данные.')) return;
  try {
    await apiDelete(`/groups/${id}`);
    renderGroups(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
