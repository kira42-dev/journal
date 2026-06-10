async function renderUsers(container) {
  let html = '<div class="toolbar"><h2>Пользователи</h2>';
  html += '<button class="btn btn-primary" onclick="showAddUserModal()">Добавить пользователя</button>';
  html += '</div>';
  html += '<div id="usersTable"><p class="empty-state">Загрузка...</p></div>';
  container.innerHTML = html;

  try {
    const users = await apiGet('/users');
    const tbody = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.role === 'teacher' ? 'Преподаватель' : 'Староста'}</td>
        <td>${u.student_name || '—'}</td>
        <td>${u.created_at}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="showEditUserModal(${u.id})">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">✕</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('usersTable').innerHTML = users.length === 0
      ? '<p class="empty-state">Нет пользователей</p>'
      : `<div class="table-container"><table>
          <thead><tr><th>ID</th><th>Логин</th><th>Роль</th><th>Студент</th><th>Создан</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('usersTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddUserModal() {
  loadStudentsForUsers().then(() => {
    createModal('userModal', 'Добавить пользователя', `
      <form id="userForm">
        <div class="form-group">
          <label>Логин</label>
          <input type="text" id="uUsername" required>
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input type="password" id="uPassword" required>
        </div>
        <div class="form-group">
          <label>Роль</label>
          <select id="uRole" onchange="toggleUserStudentField()">
            <option value="teacher">Преподаватель</option>
            <option value="headman">Староста</option>
          </select>
        </div>
        <div class="form-group" id="uStudentGroup">
          <label>Студент</label>
          <select id="uStudentId"><option value="">— Выберите студента —</option></select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal('userModal')">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    `);
    openModal('userModal');
    toggleUserStudentField();

    document.getElementById('userForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        username: document.getElementById('uUsername').value.trim(),
        password: document.getElementById('uPassword').value,
        role: document.getElementById('uRole').value,
        student_id: document.getElementById('uRole').value === 'headman' ? Number(document.getElementById('uStudentId').value) : null
      };
      if (!data.username || !data.password) return;
      if (data.role === 'headman' && !data.student_id) { alert('Выберите студента'); return; }
      try {
        await apiPost('/users', data);
        closeModal('userModal');
        renderUsers(document.getElementById('mainContent'));
      } catch (err) {
        alert(err.error || 'Ошибка');
      }
    });
  });
}

function showEditUserModal(id) {
  loadStudentsForUsers().then(() => {
    apiGet('/users').then(users => {
      const user = users.find(u => u.id === id);
      if (!user) return;
      createModal('userModal', 'Редактировать пользователя', `
        <form id="userForm">
          <div class="form-group">
            <label>Логин</label>
            <input type="text" id="uUsername" value="${user.username}" required>
          </div>
          <div class="form-group">
            <label>Новый пароль (оставьте пустым для сохранения текущего)</label>
            <input type="password" id="uPassword">
          </div>
          <div class="form-group">
            <label>Роль</label>
            <select id="uRole" onchange="toggleUserStudentField()">
              <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Преподаватель</option>
              <option value="headman" ${user.role === 'headman' ? 'selected' : ''}>Староста</option>
            </select>
          </div>
          <div class="form-group" id="uStudentGroup">
            <label>Студент</label>
            <select id="uStudentId"><option value="">— Не выбран —</option></select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" onclick="closeModal('userModal')">Отмена</button>
            <button type="submit" class="btn btn-primary">Сохранить</button>
          </div>
        </form>
      `);
      openModal('userModal');
      if (user.student_id) document.getElementById('uStudentId').value = user.student_id;
      toggleUserStudentField();

      document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { username: document.getElementById('uUsername').value.trim() };
        const pwd = document.getElementById('uPassword').value;
        if (pwd) data.password = pwd;
        data.role = document.getElementById('uRole').value;
        data.student_id = data.role === 'headman' ? Number(document.getElementById('uStudentId').value) : null;
        try {
          await apiPut(`/users/${id}`, data);
          closeModal('userModal');
          renderUsers(document.getElementById('mainContent'));
        } catch (err) {
          alert(err.error || 'Ошибка');
        }
      });
    });
  });
}

async function toggleUserStudentField() {
  const role = document.getElementById('uRole')?.value;
  const group = document.getElementById('uStudentGroup');
  if (group) {
    group.style.display = role === 'headman' ? 'block' : 'none';
  }
}

async function loadStudentsForUsers() {
  try {
    const [students, users] = await Promise.all([
      apiGet('/students'),
      apiGet('/users')
    ]);
    const headmanStudentIds = new Set(
      users.filter(u => u.role === 'headman' && u.student_id).map(u => u.student_id)
    );
    const available = students.filter(s => !headmanStudentIds.has(s.id));
    const sel = document.getElementById('uStudentId');
    if (sel) {
      sel.innerHTML = '<option value="">— Выберите студента —</option>' +
        available.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    }
  } catch { }
}

async function deleteUser(id) {
  if (!confirm('Удалить пользователя?')) return;
  try {
    await apiDelete(`/users/${id}`);
    renderUsers(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
