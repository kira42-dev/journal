async function renderExport(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Импорт / Экспорт</h2></div>';

  html += '<div class="card">';
  html += '<h3>Экспорт в Excel / CSV</h3>';
  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Данные</label><select id="expType">';
  html += '<option value="colleges">Колледжи</option>';
  html += '<option value="subjects">Предметы</option>';
  html += '<option value="topics">Темы</option>';
  html += '<option value="groups">Группы</option>';
  html += '<option value="students">Студенты</option>';
  html += '<option value="lessons">Занятия</option>';
  html += '</select></div>';
  html += '<div class="filter-group"><label>Формат</label><select id="expFormat">';
  html += '<option value="xlsx">Excel (.xlsx)</option>';
  html += '<option value="csv">CSV (.csv)</option>';
  html += '</select></div>';
  html += '<button class="btn btn-primary" onclick="downloadExport()">Скачать</button>';
  html += '</div>';

  html += '<hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">';

  html += '<h3>Экспорт всего журнала в один файл</h3>';
  html += '<p style="color:var(--text-secondary);margin:8px 0">Все таблицы (колледжи, предметы, темы, группы, студенты, занятия) в одном Excel-файле с отдельными листами.</p>';
  html += '<button class="btn btn-primary" onclick="downloadAllExport()">Скачать весь журнал (.xlsx)</button>';
  html += '</div>';

  html += '<div class="card" style="margin-top:16px">';
  html += '<h3>Экспорт журнала оценок (Журнал успеваемости)</h3>';
  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Группа</label><select id="expJournalGroup"><option value="">Выберите группу</option></select></div>';
  html += '<div class="filter-group"><label>Предмет</label><select id="expJournalSubject"><option value="">Выберите предмет</option></select></div>';
  html += '<button class="btn btn-primary" onclick="downloadJournalExport()">Скачать журнал (.xlsx)</button>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  try {
    const [groups, subjects] = await Promise.all([apiGet('/groups'), apiGet('/subjects')]);
    fillSelect('expJournalGroup', groups, 'id', 'name');
    fillSelect('expJournalSubject', subjects, 'id', 'name');
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

async function downloadFile(url) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${url}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка скачивания' }));
    throw new Error(err.error || 'Ошибка');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''(.+)/i);
  let filename = utfMatch ? decodeURIComponent(utfMatch[1]) : null;
  if (!filename) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    filename = match ? match[1] : 'export.xlsx';
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = decodeURIComponent(filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

async function downloadExport() {
  const type = document.getElementById('expType').value;
  const format = document.getElementById('expFormat').value;
  try {
    await downloadFile(`/export?type=${type}&format=${format}`);
  } catch (err) {
    alert(err.message || err.error || 'Ошибка');
  }
}

async function downloadAllExport() {
  try {
    await downloadFile('/export/all');
  } catch (err) {
    alert(err.message || err.error || 'Ошибка');
  }
}

async function downloadJournalExport() {
  const groupId = document.getElementById('expJournalGroup').value;
  const subjectId = document.getElementById('expJournalSubject').value;
  if (!groupId || !subjectId) {
    alert('Выберите группу и предмет');
    return;
  }
  try {
    await downloadFile(`/export/journal?group_id=${groupId}&subject_id=${subjectId}`);
  } catch (err) {
    alert(err.message || err.error || 'Ошибка');
  }
}