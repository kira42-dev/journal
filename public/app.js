const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getRole() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role;
  } catch {
    return null;
  }
}

function getUserName() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username;
  } catch {
    return null;
  }
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = 'index.html';
    }
    const err = await res.json().catch(() => ({ error: 'Доступ запрещён' }));
    throw err;
  }

  return res;
}

async function apiGet(url) {
  const res = await apiFetch(url);
  return res.json();
}

async function apiPost(url, data) {
  const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(data) });
  return res.json();
}

async function apiPut(url, data) {
  const res = await apiFetch(url, { method: 'PUT', body: JSON.stringify(data) });
  return res.json();
}

async function apiDelete(url) {
  const res = await apiFetch(url, { method: 'DELETE' });
  return res.json();
}

function showError(msg) {
  const el = document.getElementById('mainContent');
  if (el) {
    el.innerHTML = `<div class="card"><p class="error-message">${msg}</p></div>`;
  }
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function enableTableSort(tableId) {
  const container = document.getElementById(tableId);
  if (!container) return;

  const searchBar = document.createElement('div');
  searchBar.className = 'table-search';
  searchBar.innerHTML = '<input type="text" placeholder="Поиск по таблице..." class="search-input">';
  container.parentNode.insertBefore(searchBar, container);

  const input = searchBar.querySelector('.search-input');
  input.addEventListener('input', () => {
    const val = input.value.toLowerCase().trim();
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const text = Array.from(row.querySelectorAll('td')).map(td => td.textContent.toLowerCase()).join(' ');
      row.style.display = val && !text.includes(val) ? 'none' : '';
    });
  });

  const headers = container.querySelectorAll('thead th');
  let sortDir = {};
  headers.forEach((th, idx) => {
    const text = th.textContent.trim();
    if (text === 'Действия' || !text) return;
    th.style.cursor = 'pointer';
    th.title = 'Сортировать';
    th.addEventListener('click', () => {
      const dir = sortDir[idx] === 'asc' ? 'desc' : 'asc';
      sortDir = {};
      sortDir[idx] = dir;
      headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); });
      th.classList.add('sort-' + dir);

      const tbody = container.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const multiplier = dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const aVal = (a.children[idx]?.textContent || '').trim();
        const bVal = (b.children[idx]?.textContent || '').trim();
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * multiplier;
        return aVal.localeCompare(bVal, 'ru') * multiplier;
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    const role = getRole();
    const name = getUserName();
    userInfo.textContent = `${name} (${role === 'teacher' ? 'Преподаватель' : 'Староста'})`;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = 'index.html';
    });
  }

  renderSidebar();
});

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const role = getRole();
  let items = [];

  if (role === 'teacher') {
    items = [
      { label: 'Колледжи', page: 'colleges' },
      { label: 'Предметы', page: 'subjects' },
      { label: 'Темы', page: 'topics' },
      { label: 'Группы', page: 'groups' },
      { label: 'Студенты', page: 'students' },
      { label: 'Занятия', page: 'lessons' },
      { label: 'Журнал', page: 'grades' },
      { label: 'Отчёты', page: 'reports' },
      { label: 'Пользователи', page: 'users' }
    ];
  } else if (role === 'headman') {
    items = [
      { label: 'Студенты', page: 'students' },
      { label: 'Занятия', page: 'lessons' },
      { label: 'Журнал', page: 'grades' },
      { label: 'Отчёты', page: 'reports' }
    ];
  }

  const ul = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.label;
    li.dataset.page = item.page;
    li.addEventListener('click', () => {
      document.querySelectorAll('#sidebar li').forEach(el => el.classList.remove('active'));
      li.classList.add('active');
      loadPage(item.page);
    });
    ul.appendChild(li);
  });
  sidebar.appendChild(ul);
}

async function loadPage(pageName) {
  const mainContent = document.getElementById('mainContent');
  if (!mainContent) return;

  switch (pageName) {
    case 'colleges':
      await renderColleges(mainContent);
      break;
    case 'subjects':
      await renderSubjects(mainContent);
      break;
    case 'topics':
      await renderTopics(mainContent);
      break;
    case 'groups':
      await renderGroups(mainContent);
      break;
    case 'students':
      await renderStudents(mainContent);
      break;
    case 'lessons':
      await renderLessons(mainContent);
      break;
    case 'grades':
      await renderGrades(mainContent);
      break;
    case 'reports':
      await renderReports(mainContent);
      break;
    case 'users':
      await renderUsers(mainContent);
      break;
    default:
      mainContent.innerHTML = '<h2>Страница не найдена</h2>';
  }
}

function createModal(id, title, contentHtml) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      ${contentHtml}
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(id);
  });
  document.body.appendChild(overlay);
}
