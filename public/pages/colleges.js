async function renderColleges(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Колледжи</h2>';
  if (role === 'teacher') {
    html += '<button class="btn btn-primary" onclick="showAddCollegeModal()">Добавить колледж</button>';
  }
  html += '</div><div id="collegesTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  try {
    const colleges = await apiGet('/colleges');
    const tbody = colleges.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>${c.name}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditCollegeModal(${c.id}, '${escapeAttr(c.name)}')">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCollege(${c.id})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('collegesTable').innerHTML = colleges.length === 0
      ? '<p class="empty-state">Нет колледжей</p>'
      : `<div class="table-container" id="collegesTableInner"><table>
          <thead><tr><th>ID</th><th>Название</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
    enableTableSort('collegesTableInner');
  } catch (err) {
    document.getElementById('collegesTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddCollegeModal() {
  createModal('collegeModal', 'Добавить колледж', `
    <form id="collegeForm">
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="collegeName" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('collegeModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('collegeModal');

  document.getElementById('collegeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('collegeName').value.trim();
    if (!name) return;
    try {
      await apiPost('/colleges', { name });
      closeModal('collegeModal');
      renderColleges(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditCollegeModal(id, currentName) {
  createModal('collegeModal', 'Редактировать колледж', `
    <form id="collegeForm">
      <div class="form-group">
        <label>Название</label>
        <input type="text" id="collegeName" value="${currentName}" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('collegeModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('collegeModal');

  document.getElementById('collegeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('collegeName').value.trim();
    if (!name) return;
    try {
      await apiPut(`/colleges/${id}`, { name });
      closeModal('collegeModal');
      renderColleges(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function deleteCollege(id) {
  if (!confirm('Удалить колледж? Это удалит все связанные данные.')) return;
  try {
    await apiDelete(`/colleges/${id}`);
    renderColleges(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
