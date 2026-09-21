(function () {
  'use strict';

  const queue = [
    { tone: 'danger', label: 'Просрочено', title: 'Ответить 3 кандидатам', meta: 'Максим Соколов, Елена Власова и ещё 1 · сегодня', action: 'Открыть кандидатов' },
    { tone: 'warning', label: 'Сегодня', title: 'Подтвердить решения по резюме', meta: '2 резюме ожидают решения руководителя', action: 'Открыть резюме' },
    { tone: 'brand', label: '16:00', title: 'Финальное интервью', meta: 'Елена Власова · Маркетолог · онлайн', action: 'Открыть событие' },
    { tone: 'muted', label: 'Завтра', title: 'Проверить задачи onboarding', meta: '4 задачи требуют внимания', action: 'Открыть onboarding' }
  ];

  const vacancies = [
    { title: 'Product Manager', department: 'Продукт', owner: 'Анна Крылова', count: 42, stage: '8 на интервью', progress: 72, state: 'В графике', tone: 'good' },
    { title: 'Senior Developer', department: 'Разработка', owner: 'Иван Петров', count: 61, stage: '11 на интервью', progress: 48, state: 'Требует внимания', tone: 'warning' },
    { title: 'Маркетолог', department: 'Маркетинг', owner: 'Мария Соколова', count: 28, stage: '6 на интервью', progress: 64, state: 'В графике', tone: 'good' },
    { title: 'HR Business Partner', department: 'HR', owner: 'Мария Соколова', count: 14, stage: '4 на интервью', progress: 31, state: 'Новая', tone: 'brand' }
  ];

  const events = [
    { time: '10:00', type: 'Интервью', person: 'Анна Кузнецова', detail: 'Product Manager · Анна Крылова' },
    { time: '13:30', type: 'Скрининг', person: 'Максим Соколов', detail: 'Senior Developer · Иван Петров' },
    { time: '16:00', type: 'Финальное интервью', person: 'Елена Власова', detail: 'Маркетолог · Мария Соколова' }
  ];

  function row(item) {
    return `<div class="dash-queue-row"><span class="dash-queue-marker ${item.tone}"></span><div class="dash-queue-copy"><div class="dash-queue-top"><b>${item.title}</b><span class="dash-queue-label ${item.tone}">${item.label}</span></div><small>${item.meta}</small></div><button class="btn dash-quiet-action" type="button" data-dashboard-action="${item.action}">Открыть</button></div>`;
  }

  function vacancy(item) {
    return `<div class="dash-vacancy-row"><div class="dash-vacancy-main"><div class="dash-vacancy-title"><b>${item.title}</b><span class="dash-state ${item.tone}">${item.state}</span></div><small>${item.department} · ${item.owner}</small></div><div class="dash-vacancy-stat"><b>${item.count}</b><small>откликов</small></div><div class="dash-vacancy-stage"><b>${item.stage}</b><div class="dash-progress"><i style="width:${item.progress}%"></i></div></div><button class="btn dash-quiet-action" type="button" data-dashboard-action="Открыть вакансию ${item.title}">Открыть</button></div>`;
  }

  function render() {
    const root = document.getElementById('dashboard');
    if (!root || root.dataset.previewDashboard === 'true') return;
    root.dataset.previewDashboard = 'true';
    root.innerHTML = `<div class="dash-preview-shell">
      <div class="top dash-preview-top"><div class="title"><span class="dash-eyebrow">Рабочий центр рекрутера</span><h1>Дашборд</h1><p>Главное по найму, задачам и команде на сегодня</p></div><div class="dash-preview-actions"><span class="dash-period"><span class="dash-period-dot"></span>Текущий месяц <span class="dash-chevron"></span></span><button class="btn primary" type="button" data-dashboard-action="Создать задачу">+ Создать задачу</button></div></div>
      <div class="dash-kpis"><div class="card dash-kpi"><span class="dash-kpi-icon blue">↗</span><div><small>Открытые вакансии</small><b>12</b><em class="positive">+2 за месяц</em></div></div><div class="card dash-kpi"><span class="dash-kpi-icon purple">◉</span><div><small>Активные кандидаты</small><b>248</b><em class="positive">+18% к прошлому месяцу</em></div></div><div class="card dash-kpi"><span class="dash-kpi-icon green">◷</span><div><small>Интервью на неделе</small><b>34</b><em>8 сегодня</em></div></div><div class="card dash-kpi"><span class="dash-kpi-icon orange">✓</span><div><small>Нанято за месяц</small><b>9</b><em class="positive">+3 к прошлому месяцу</em></div></div></div>
      <div class="dash-priority-grid"><section class="card section dash-panel dash-queue-panel"><div class="dash-panel-head"><div><span class="dash-eyebrow">Требует внимания</span><h2>Моя очередь</h2></div><span class="dash-count-badge">4 задачи</span></div><div class="dash-queue-list">${queue.map(row).join('')}</div><button class="btn dash-panel-link" type="button" data-dashboard-action="Все задачи">Показать все задачи <span>→</span></button></section><section class="card section dash-panel dash-funnel-panel"><div class="dash-panel-head"><div><span class="dash-eyebrow">Конверсия процесса</span><h2>Воронка найма</h2></div><button class="btn dash-panel-link" type="button" data-dashboard-action="Открыть воронку">Открыть воронку <span>→</span></button></div><div class="dash-funnel"><div class="dash-funnel-row"><span>Отклики</span><div class="dash-funnel-bar"><i style="width:100%"></i></div><b>248</b><small>—</small></div><div class="dash-funnel-row"><span>Скрининг</span><div class="dash-funnel-bar"><i style="width:35%"></i></div><b>86</b><small>34,7%</small></div><div class="dash-funnel-row"><span>Интервью</span><div class="dash-funnel-bar"><i style="width:14%"></i></div><b>34</b><small>39,5%</small></div><div class="dash-funnel-row"><span>Оффер</span><div class="dash-funnel-bar"><i style="width:5%"></i></div><b>12</b><small>35,3%</small></div><div class="dash-funnel-row final"><span>Нанято</span><div class="dash-funnel-bar"><i style="width:3.6%"></i></div><b>9</b><small>75%</small></div></div><div class="dash-funnel-summary"><span>Среднее время закрытия</span><b>24 дня</b><span>Конверсия отклик → найм</span><b>3,6%</b></div></section></div>
      <div class="dash-secondary-grid"><section class="card section dash-panel dash-vacancies-panel"><div class="dash-panel-head"><div><span class="dash-eyebrow">В работе</span><h2>Активные вакансии</h2></div><button class="btn dash-panel-link" type="button" data-dashboard-action="Все вакансии">Все вакансии <span>→</span></button></div><div class="dash-vacancy-list">${vacancies.map(vacancy).join('')}</div></section><section class="card section dash-panel dash-events-panel"><div class="dash-panel-head"><div><span class="dash-eyebrow">Сегодня</span><h2>Ближайшие события</h2></div><button class="btn dash-panel-link" type="button" data-dashboard-action="Календарь">Календарь <span>→</span></button></div><div class="dash-events-list">${events.map((event, index) => `<div class="dash-event-row"><div class="dash-event-time">${event.time}</div><span class="dash-event-line ${index===2?'last':''}"></span><div><b>${event.type}</b><strong>${event.person}</strong><small>${event.detail}</small></div></div>`).join('')}</div></section></div>
      <section class="card section dash-alerts"><div class="dash-panel-head"><div><span class="dash-eyebrow">Контроль качества</span><h2>Что требует решения</h2></div><span class="dash-alerts-caption">Обновлено сегодня</span></div><div class="dash-alert-grid"><div class="dash-alert-item danger"><span>!</span><div><b>2 вакансии без зарплатной вилки</b><small>Добавьте диапазон, чтобы повысить конверсию откликов</small></div><button class="btn dash-quiet-action" type="button" data-dashboard-action="Проверить вакансии">Проверить</button></div><div class="dash-alert-item warning"><span>◷</span><div><b>4 задачи onboarding просрочены</b><small>Назначьте ответственных и обновите сроки</small></div><button class="btn dash-quiet-action" type="button" data-dashboard-action="Открыть onboarding">Открыть</button></div><div class="dash-alert-item blue"><span>↗</span><div><b>3 резюме ожидают решения</b><small>Руководители ещё не дали обратную связь</small></div><button class="btn dash-quiet-action" type="button" data-dashboard-action="Открыть согласования">Открыть</button></div></div></section>
    </div>`;
    root.querySelectorAll('[data-dashboard-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.dashboardAction;
      if (action === 'Открыть воронку') document.querySelector('[data-view="pipeline"]')?.click();
      else if (action === 'Все вакансии' || action.startsWith('Открыть вакансию')) document.querySelector('[data-view="vacancies"]')?.click();
      else if (action === 'Открыть onboarding') document.querySelector('[data-view="onboarding"]')?.click();
      else if (action === 'Календарь') document.querySelector('[data-view="recruitment"]')?.click();
      else if (action === 'Открыть согласования') window.openApprovals?.();
      else if (typeof window.toast === 'function') window.toast(`${action}: демо-действие`);
    }));
  }

  window.renderDashboardPreview = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
