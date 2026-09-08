async function renderExams(container) {
  const role = getRole();
  let html = '<div class="toolbar"><h2>Экзамены и билеты</h2></div>';

  html += '<div class="filters">';
  html += '<div class="filter-group"><label>Предмет</label><select id="examSubjectFilter"><option value="">Выберите предмет с экзаменом</option></select></div>';
  html += '</div>';

  html += '<div id="examsContent"><p class="empty-state">Выберите предмет для просмотра экзаменационных билетов</p></div>';
  container.innerHTML = html;

  try {
    const subjects = await apiGet('/subjects');
    const examSubjects = subjects.filter(s => s.assessment_type === 'exam');
    const select = document.getElementById('examSubjectFilter');
    examSubjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.course} курс, ${s.semester} сем.)`;
      select.appendChild(opt);
    });
    select.addEventListener('change', loadExams);
    if (examSubjects.length === 0) {
      document.getElementById('examsContent').innerHTML = '<p class="empty-state">Нет предметов с формой контроля «Экзамен». Создайте предмет и выберите «Экзамен» как форму контроля.</p>';
    }
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

async function loadExams() {
  const subjectId = document.getElementById('examSubjectFilter')?.value;
  const container = document.getElementById('examsContent');
  if (!subjectId) {
    container.innerHTML = '<p class="empty-state">Выберите предмет</p>';
    return;
  }

  try {
    const data = await apiGet(`/exams?subject_id=${subjectId}`);
    let html = `<div class="card"><h3>${data.subject.name}</h3></div>`;
    html += `<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="showAddTicketModal(${subjectId})">Добавить билет</button></div>`;

    if (data.tickets.length === 0) {
      html += '<p class="empty-state">Нет билетов. Добавьте первый билет.</p>';
    } else {
      html += data.tickets.map(t => `
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0">Билет № ${t.ticket_number}</h3>
            <div class="btn-group">
              <button class="btn btn-sm btn-outline" onclick="showEditTicketModal(${t.id}, ${t.ticket_number})">✎</button>
              <button class="btn btn-sm btn-danger" onclick="deleteTicket(${t.id})">✕</button>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="showAddQuestionModal(${t.id})" style="margin-bottom:8px">Добавить вопрос</button>
          ${t.questions.length === 0
            ? '<p class="text-secondary" style="padding:0">Нет вопросов</p>'
            : `<ul style="list-style:none;padding:0">
                ${t.questions.map(q => `
                  <li style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--cream-light);border-radius:10px;margin-bottom:6px">
                    <span><strong>${q.question_number}.</strong> ${q.question_text}</span>
                    <div class="btn-group">
                      <button class="btn btn-sm btn-outline" onclick="showEditQuestionModal(${q.id}, ${q.question_number}, '${escapeAttr(q.question_text)}')">✎</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id})">✕</button>
                    </div>
                  </li>
                `).join('')}
              </ul>`}
        </div>
      `).join('');
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="error-message">${err.error || 'Ошибка загрузки'}</p>`;
  }
}

function showAddTicketModal(subjectId) {
  createModal('examTicketModal', 'Добавить билет', `
    <form id="examTicketForm">
      <div class="form-group">
        <label>Номер билета</label>
        <input type="number" id="etNumber" min="1" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('examTicketModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('examTicketModal');

  document.getElementById('examTicketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      subject_id: Number(subjectId),
      ticket_number: Number(document.getElementById('etNumber').value)
    };
    try {
      await apiPost('/exams/tickets', data);
      closeModal('examTicketModal');
      loadExams();
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditTicketModal(id, number) {
  createModal('examTicketModal', 'Редактировать билет', `
    <form id="examTicketForm">
      <div class="form-group">
        <label>Номер билета</label>
        <input type="number" id="etNumber" value="${number}" min="1" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('examTicketModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('examTicketModal');

  document.getElementById('examTicketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPut(`/exams/tickets/${id}`, { ticket_number: Number(document.getElementById('etNumber').value) });
      closeModal('examTicketModal');
      loadExams();
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function deleteTicket(id) {
  if (!confirm('Удалить билет и все его вопросы?')) return;
  try {
    await apiDelete(`/exams/tickets/${id}`);
    loadExams();
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}

function showAddQuestionModal(ticketId) {
  createModal('examQuestionModal', 'Добавить вопрос', `
    <form id="examQuestionForm">
      <div class="form-group">
        <label>Номер вопроса</label>
        <input type="number" id="eqNumber" value="1" min="1">
      </div>
      <div class="form-group">
        <label>Текст вопроса</label>
        <textarea id="eqText" rows="4" required></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('examQuestionModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('examQuestionModal');

  document.getElementById('examQuestionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      ticket_id: Number(ticketId),
      question_number: Number(document.getElementById('eqNumber').value),
      question_text: document.getElementById('eqText').value.trim()
    };
    if (!data.question_text) return;
    try {
      await apiPost('/exams/questions', data);
      closeModal('examQuestionModal');
      loadExams();
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

function showEditQuestionModal(id, number, text) {
  createModal('examQuestionModal', 'Редактировать вопрос', `
    <form id="examQuestionForm">
      <div class="form-group">
        <label>Номер вопроса</label>
        <input type="number" id="eqNumber" value="${number}" min="1">
      </div>
      <div class="form-group">
        <label>Текст вопроса</label>
        <textarea id="eqText" rows="4" required>${text}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal('examQuestionModal')">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить</button>
      </div>
    </form>
  `);
  openModal('examQuestionModal');

  document.getElementById('examQuestionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      question_number: Number(document.getElementById('eqNumber').value),
      question_text: document.getElementById('eqText').value.trim()
    };
    if (!data.question_text) return;
    try {
      await apiPut(`/exams/questions/${id}`, data);
      closeModal('examQuestionModal');
      loadExams();
    } catch (err) {
      alert(err.error || 'Ошибка');
    }
  });
}

async function deleteQuestion(id) {
  if (!confirm('Удалить вопрос?')) return;
  try {
    await apiDelete(`/exams/questions/${id}`);
    loadExams();
  } catch (err) {
    alert(err.error || 'Ошибка');
  }
}