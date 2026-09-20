const vacancyPipelineStages = ['Отклики', 'Скрининг', 'Интервью', 'Оффер', 'Нанято'];
const vacancyDemoTasks = [
  ['Проверить требования и вилку зарплаты', 'Рекрутер', 'Сегодня', true],
  ['Согласовать профиль кандидата с руководителем', 'Анна Крылова', 'Завтра', false],
  ['Обновить шаблон первого сообщения', 'Рекрутер', '22 сентября', false],
];
const vacancyDemoHistory = [
  ['сегодня, 10:42', 'Анна Крылова', 'Обновила описание вакансии'],
  ['вчера, 16:18', 'Евгений Шумов', 'Изменён ответственный руководитель'],
  ['18 сентября, 11:05', 'Система', 'Подключён источник HeadHunter'],
];

function vacancyPipelineStats(vacancy) {
  const responses = typeof vacancyResponses === 'function' ? vacancyResponses(vacancy) : [];
  const candidates = (data.candidates || []).filter((candidate) => candidate.vac === vacancy.title);
  return vacancyPipelineStages.map((stage) => {
    const responseCount = responses.filter((item) => stage === 'Отклики').length;
    const candidateCount = candidates.filter((item) => item.stage === stage).length;
    return stage === 'Отклики' ? responseCount + candidateCount : candidateCount;
  });
}

function vacancyQuality(vacancy) {
  const checks = [
    ['Описание и задачи', Boolean(vacancy.desc)],
    ['Зарплатная вилка', Boolean(vacancy.salary)],
    ['Формат работы', Boolean(vacancy.workMode || 'Гибрид')],
    ['Руководитель', Boolean(vacancy.owner)],
    ['Финальное решение', Boolean(vacancy.decisionMaker || vacancy.owner)],
  ];
  return { checks, percent: Math.round(checks.filter((item) => item[1]).length / checks.length * 100) };
}

function vacancyTaskToggle(index, checked) {
  const saved = JSON.parse(localStorage.getItem('teamdeck-vacancy-tasks') || '{}');
  saved[index] = checked;
  localStorage.setItem('teamdeck-vacancy-tasks', JSON.stringify(saved));
  const row = document.querySelector(`[data-vacancy-task="${index}"]`);
  if (row) row.classList.toggle('is-done', checked);
}

function openVacancyWorkspace(id) {
  const vacancy = data.vacancies.find((item) => item.id === id);
  if (!vacancy) return;
  const stats = vacancyPipelineStats(vacancy);
  const total = stats.reduce((sum, value) => sum + value, 0);
  const quality = vacancyQuality(vacancy);
  const savedTasks = JSON.parse(localStorage.getItem('teamdeck-vacancy-tasks') || '{}');
  const sources = [...new Set((typeof vacancyResponses === 'function' ? vacancyResponses(vacancy) : []).map((item) => item.source))];
  const sourceList = sources.length ? sources : ['HeadHunter', 'Работа.ру', 'Карьерный сайт'];
  const conversion = (index) => index === 0 || !stats[index - 1] ? '—' : `${Math.round(stats[index] / stats[index - 1] * 100)}%`;

  document.getElementById('modalContent').innerHTML = `<div class="vacancy-workspace">
    <div class="vacancy-workspace-header">
      <div><div class="vacancy-workspace-kicker">РАБОЧИЙ ЦЕНТР ВАКАНСИИ</div><h2>${vacancy.title}</h2><p>${vacancy.dept} · ${vacancy.level} · ${vacancy.salary}</p></div>
      <div class="vacancy-workspace-header-actions"><span class="badge ${vacancy.status === 'Открыта' ? 'green' : 'yellow'}">${vacancy.status}</span><button class="close" onclick="closeModal()">×</button></div>
    </div>
    <div class="vacancy-workspace-owner"><span class="avatar">${initials(vacancy.owner)}</span><span><b>Нанимающий руководитель</b><small>${vacancy.owner}</small></span><span class="vacancy-owner-divider"></span><span><b>Рекрутер</b><small>Евгений Шумов</small></span><button class="btn primary vacancy-responses-button" onclick="openVacancyResponses(${vacancy.id})">Открыть отклики <strong>${total}</strong></button></div>
    <div class="vacancy-workspace-body">
      <section class="vacancy-workspace-main">
        <div class="vacancy-workspace-card vacancy-description-card"><div class="vacancy-card-heading"><h3>О вакансии</h3><button class="btn vacancy-mini-action" onclick="toast('Редактирование вакансии будет доступно в следующем обновлении')">Изменить</button></div><p>${vacancy.desc || 'Описание вакансии пока не заполнено.'}</p><div class="vacancy-facts"><span><b>Формат</b>${vacancy.workMode || 'Гибрид'}</span><span><b>Уровень</b>${vacancy.level}</span><span><b>Вилка</b>${vacancy.salary}</span></div></div>
        <div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>Воронка найма</h3><span class="mini">${total} кандидатов в процессе</span></div><div class="vacancy-pipeline">${stats.map((count, index) => `<div class="vacancy-pipeline-row"><div class="vacancy-pipeline-label"><b>${vacancyPipelineStages[index]}</b><span>${count} · ${conversion(index)}</span></div><div class="vacancy-pipeline-bar"><i style="width:${Math.max(count ? Math.min(100, count / Math.max(...stats, 1) * 100) : 2, 2)}%"></i></div></div>`).join('')}</div></div>
        <div class="vacancy-workspace-split"><div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>Активные задачи</h3><span class="mini">${vacancyDemoTasks.filter((task, i) => !(savedTasks[i] ?? task[3])).length} требуют внимания</span></div><div class="vacancy-task-list">${vacancyDemoTasks.map((task, index) => `<label class="vacancy-task-row ${(savedTasks[index] ?? task[3]) ? 'is-done' : ''}" data-vacancy-task="${index}"><input type="checkbox" ${(savedTasks[index] ?? task[3]) ? 'checked' : ''} onchange="vacancyTaskToggle(${index},this.checked)"><span><b>${task[0]}</b><small>${task[1]} · ${task[2]}</small></span></label>`).join('')}</div></div><div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>Качество вакансии</h3><strong class="vacancy-quality-score">${quality.percent}%</strong></div><div class="vacancy-quality-bar"><i style="width:${quality.percent}%"></i></div><div class="vacancy-quality-list">${quality.checks.map((check) => `<span class="${check[1] ? 'is-complete' : ''}"><b>${check[1] ? '✓' : '!'}</b>${check[0]}</span>`).join('')}</div></div></div>
      </section>
      <aside class="vacancy-workspace-side"><div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>История изменений</h3></div><div class="vacancy-history">${vacancyDemoHistory.map((event) => `<div><small>${event[0]}</small><b>${event[1]}</b><span>${event[2]}</span></div>`).join('')}</div></div><div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>Шаблоны коммуникаций</h3><button class="btn vacancy-mini-action" onclick="nav('settings');closeModal()">Настроить</button></div><div class="vacancy-template-list"><button onclick="toast('Открыт шаблон первого сообщения')"><span>✦</span><b>Первое касание</b><small>После нового отклика</small></button><button onclick="toast('Открыт шаблон приглашения')"><span>↗</span><b>Приглашение на интервью</b><small>Этап «Интервью»</small></button><button onclick="toast('Открыт шаблон отказа')"><span>—</span><b>Отказ</b><small>После решения</small></button></div></div><div class="vacancy-workspace-card"><div class="vacancy-card-heading"><h3>Источники</h3><button class="btn vacancy-mini-action" onclick="toast('Каталог источников откроется здесь')">Управлять</button></div><div class="vacancy-source-list">${sourceList.map((source) => `<span><i></i>${source}<b>${source === 'HeadHunter' ? 'Подключён' : 'Активен'}</b></span>`).join('')}</div></div></aside>
    </div>
  </div>`;
  openModal();
}
