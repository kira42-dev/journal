async function renderTopics(container) {
  const prevSubjectId = document.getElementById('subjectFilter')?.value || '';
  const role = getRole();
  let html = '<div class="toolbar"><h2>Темы</h2>';
  if (role === 'teacher') {
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="btn btn-outline" onclick="exportFile(\'/export/topics\', \'topics.xlsx\')">Экспорт</button>';
    html += '<button class="btn btn-outline" onclick="showImportModal({url:\'/import/topics\', reload:()=>renderTopics(document.getElementById(\'mainContent\')), columns:[\'Тема\',\'Предмет\',\'Порядок\']})">Импорт</button>';
    html += '<button class="btn btn-primary" onclick="showAddTopicModal()">Добавить тему</button>';
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Предмет</label><select id="subjectFilter"><option value="">Выберите предмет</option></select></div>';
  html += '</div>';
  html += '<div id="topicsTable"><p class="empty-state">Выберите предмет для просмотра тем</p></div>';
  container.innerHTML = html;

  document.getElementById('subjectFilter').addEventListener('change', loadTopicsTable);
  await loadTopicsTable(prevSubjectId);
}

async function loadTopicsTable(defaultVal) {
  const select = document.getElementById('subjectFilter');
  try {
    const subjects = await apiGet('/subjects');
    const currentVal = select.value || defaultVal || '';
    subjects.forEach(s => {
      if (!select.querySelector(`option[value="${s.id}"]`)) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (ID: ${s.id})`;
        select.appendChild(opt);
      }
    });
    select.value = currentVal;

    const subjectId = select.value;
    if (!subjectId) {
      document.getElementById('topicsTable').innerHTML = '<p class="empty-state">Выберите предмет для просмотра тем</p>';
      return;
    }

    const role = getRole();
    const topics = await apiGet(`/topics?subject_id=${subjectId}`);

    const tbody = topics.map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${t.name}</td>
        <td>${t.order_index}</td>
        <td>
          ${role === 'teacher' ? `
            <button class="btn btn-sm btn-outline" onclick="showEditTopicModal(${escapeAttr(t.id)}, '${escapeAttr(t.name)}', ${t.order_index})">✎</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTopic(${escapeAttr(t.id)})">✕</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    document.getElementById('topicsTable').innerHTML = topics.length === 0
      ? '<p class="empty-state">Нет тем</p>'
      : `<div class="table-container"><table>
          <thead><tr><th>ID</th><th>Название</th><th>Порядок</th><th>Действия</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table></div>`;
  } catch (err) {
    document.getElementById('topicsTable').innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddTopicModal() {
  const subjectId = document.getElementById('subjectFilter')?.value;
  if (!subjectId) { alert('Выберите предмет'); return; }

  createModal('topicModal', 'Добавить тему', `
    <form id="topicForm">
      <div class="form-group">
        <label>Название темы</label>
        <input type="text" id="tName" required>
      </div>
      <div class="form-group">
        <label>Порядковый индекс</label>
        <input type="number" id="tOrder" value="0">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('topicModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('topicModal');

  document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      subject_id: Number(subjectId),
      name: document.getElementById('tName').value.trim(),
      order_index: Number(document.getElementById('tOrder').value)
    };
    if (!data.name) return;
    try {
      await apiPost('/topics', data);
      closeModal('topicModal');
      renderTopics(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditTopicModal(id, currentName, currentOrder) {
  createModal('topicModal', 'Редактировать тему', `
    <form id="topicForm">
      <div class="form-group">
        <label>Название темы</label>
        <input type="text" id="tName" value="${currentName}" required>
      </div>
      <div class="form-group">
        <label>Порядковый индекс</label>
        <input type="number" id="tOrder" value="${currentOrder}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('topicModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('topicModal');

  document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('tName').value.trim(),
      order_index: Number(document.getElementById('tOrder').value)
    };
    if (!data.name) return;
    try {
      await apiPut(`/topics/${id}`, data);
      closeModal('topicModal');
      renderTopics(document.getElementById('mainContent'));
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function deleteTopic(id) {
  if (!confirm('Удалить тему?')) return;
  try {
    await apiDelete(`/topics/${id}`);
    renderTopics(document.getElementById('mainContent'));
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}
