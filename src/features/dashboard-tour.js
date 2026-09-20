(function () {
  'use strict';

  const pageTitles = {
    dashboard: 'Дашборд', vacancies: 'Вакансии', candidates: 'Кандидаты', pipeline: 'Воронка найма', onboarding: 'Онбординг', team: 'Команда', offboarding: 'Оффбординг', analytics: 'Аналитика', integrations: 'Интеграции', recruitment: 'Рекрутмент', settings: 'Настройки',
  };

  const pageSteps = {
    dashboard: [
      ['.title', 'Дашборд', 'Здесь собран главный обзор процесса найма: текущие показатели, события и последние изменения в команде.', 'bottom'],
      ['.approval-button', 'Согласования', 'В этом разделе руководитель видит запросы и может принимать решения по ним.', 'bottom'],
      ['.grid.kpis', 'Ключевые показатели', 'Верхние карточки показывают текущий объём вакансий, кандидатов, интервью и найма.', 'bottom'],
      ['.grid:not(.kpis) > .section:first-child', 'Воронка найма', 'Следите, сколько кандидатов находится на каждом этапе — от отклика до выхода на работу.', 'right'],
      ['.grid:not(.kpis) > .section:nth-child(2)', 'Ближайшие события', 'Здесь отображаются запланированные интервью, скрининги и другие важные события команды.', 'left'],
      ['.dashboard-grid', 'Эффективность и активность', 'Эти блоки помогают быстро оценить скорость работы команды и динамику последних дней.', 'top'],
      ['.dashboard-updates', 'Последние обновления', 'В нижней части дашборда хранится краткая история действий по кандидатам, вакансиям и команде.', 'top'],
    ],
    vacancies: [['.title', 'Вакансии', 'Здесь находится рабочий список открытых позиций и их текущий статус.', 'bottom'], ['.card.section', 'Список вакансий', 'Открывайте вакансию, просматривайте отклики и переходите к рабочему центру позиции.', 'top'], ['.table', 'Данные и фильтры', 'Используйте поиск и таблицу, чтобы быстро найти нужную вакансию.', 'top']],
    candidates: [['.title', 'Кандидаты', 'Здесь хранится единый список кандидатов и их профилей.', 'bottom'], ['.card.section', 'Список кандидатов', 'Открывайте профиль, резюме, коммуникации и историю кандидата.', 'top'], ['.table', 'Поиск и фильтры', 'Используйте поиск и фильтр, чтобы быстро находить нужных людей.', 'top']],
    pipeline: [['.title', 'Воронка найма', 'Перемещайте кандидатов между этапами и контролируйте движение по каждой вакансии.', 'bottom'], ['#kanban', 'Канбан-доска', 'Карточка кандидата показывает текущий этап и позволяет быстро обновить статус.', 'top']],
    onboarding: [['.title', 'Онбординг', 'Здесь команда сопровождает сотрудника от подготовки выхода до завершения адаптации.', 'bottom'], ['#onboardingFunnel', 'Воронка онбординга', 'Следите за этапом каждого нового сотрудника и открывайте его чек-лист.', 'top'], ['#onboardingUpcoming', 'Ближайшие контрольные точки', 'Контролируйте встречи и задачи, которые нельзя пропустить в период адаптации.', 'top']],
    team: [['.title', 'Команда', 'Здесь собрана организационная структура компании и карточки сотрудников.', 'bottom'], ['.company-kpis', 'Показатели команды', 'Быстро оценивайте численность, департаменты и сотрудников на испытательном сроке.', 'bottom'], ['.company-structure', 'Организационная структура', 'Нажмите на департамент, чтобы открыть список сотрудников и их профили.', 'top']],
    offboarding: [['.title', 'Оффбординг', 'Здесь контролируется процесс ухода сотрудников и закрытия доступов.', 'bottom'], ['#offboardingFunnel', 'Воронка оффбординга', 'Перемещайте сотрудников по этапам и открывайте чек-лист процесса.', 'top'], ['#offboardingCalendar', 'Календарь событий', 'Следите за контрольными точками и датами завершения процессов.', 'top']],
    analytics: [['.title', 'Аналитика', 'Здесь руководители оценивают эффективность рекрутинга на основе единого набора данных.', 'bottom'], ['.analytics-grid', 'Показатели аналитики', 'Фильтруйте отчёт по периоду, департаменту и рекрутеру.', 'bottom'], ['#analyticsVacancyBody', 'Эффективность вакансий', 'Сравнивайте вакансии и находите точки роста процесса найма.', 'top'], ['#analyticsPlatformBody', 'Рейтинг площадок', 'Сравнивайте источники откликов по конверсии в кандидатов и в найм.', 'top']],
    integrations: [['.title', 'Интеграции', 'Подключайте площадки и сервисы, чтобы данные автоматически попадали в Teamdeck.', 'bottom'], ['#intGrid', 'Каталог интеграций', 'Выберите нужный сервис и настройте синхронизацию.', 'top'], ['.sync-steps', 'Как работает синхронизация', 'После подключения данные появляются в соответствующих разделах платформы.', 'top']],
    recruitment: [['.title', 'Рекрутмент', 'Здесь распределяется работа между участниками процесса найма.', 'bottom'], ['#teamGrid', 'Участники рекрутмента', 'Открывайте карточку коллеги, чтобы посмотреть его роль и рабочий контекст.', 'top'], ['.hiring-calendar', 'Календарь найма', 'Контролируйте запланированные события и загрузку команды.', 'top']],
    settings: [['.title', 'Настройки', 'Здесь можно настроить рабочее пространство, язык, календарь, коммуникации и безопасность.', 'bottom'], ['.settings-grid > .card:nth-child(1)', 'Оформление', 'Выберите тему интерфейса и фирменный цвет, чтобы настроить внешний вид рабочего пространства.', 'bottom'], ['.settings-grid > .card:nth-child(2)', 'Язык и регион', 'Настройте язык интерфейса, часовой пояс и региональные параметры рабочей среды.', 'bottom'], ['.settings-grid > .card:nth-child(3)', 'Настройки календаря', 'Укажите первый день недели, формат времени и параметры отображения рабочих событий.', 'bottom'], ['.settings-grid > .card:nth-child(4)', 'Шаблоны', 'Создавайте и редактируйте готовые сообщения для скрининга, отказов, офферов, онбординга и оффбординга.', 'top'], ['.settings-grid > .card.security-card', 'Безопасность', 'Управляйте двухфакторной защитой, активными сессиями, историей входов и резервными кодами.', 'top'], ['.settings-grid > .card.backup-card', 'Резервное копирование', 'Проверяйте дату последней копии и управляйте созданием резервной копии данных рабочего пространства.', 'top']],
  };

  let currentStep = 0;
  let active = false;
  let activeView = 'dashboard';
  let resizeHandler;

  function view() { return document.querySelector('.views.active')?.id || 'dashboard'; }
  function stateKey(name) { return `teamdeck-${name}-tour-state`; }
  function getTarget(selector) {
    const root = document.getElementById(activeView);
    if (!root) return null;
    return root.querySelector(selector);
  }

  function ensureElements() {
    if (document.getElementById('dashboardTour')) return;
    const root = document.createElement('div');
    root.id = 'dashboardTour'; root.className = 'dashboard-tour'; root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="dashboard-tour-backdrop"></div><div class="dashboard-tour-card" role="dialog" aria-modal="true" aria-labelledby="dashboardTourTitle"><div class="dashboard-tour-kicker"></div><h2 id="dashboardTourTitle"></h2><p id="dashboardTourText"></p><div class="dashboard-tour-footer"><span class="dashboard-tour-progress"></span><div class="dashboard-tour-actions"><button type="button" class="dashboard-tour-skip">Пропустить</button><button type="button" class="dashboard-tour-back">Назад</button><button type="button" class="btn primary dashboard-tour-next">Далее</button></div></div></div>';
    document.body.appendChild(root);
    root.querySelector('.dashboard-tour-backdrop').addEventListener('click', () => finish('skipped'));
    root.querySelector('.dashboard-tour-skip').addEventListener('click', () => finish('skipped'));
    root.querySelector('.dashboard-tour-back').addEventListener('click', () => renderStep(currentStep - 1));
    root.querySelector('.dashboard-tour-next').addEventListener('click', () => currentStep >= pageSteps[activeView].length - 1 ? finish('completed') : renderStep(currentStep + 1));
  }

  function updateSpotlight(target) {
    const root = document.getElementById('dashboardTour');
    const rect = target.getBoundingClientRect();
    root.style.setProperty('--tour-top', `${Math.max(8, rect.top - 8)}px`);
    root.style.setProperty('--tour-left', `${Math.max(8, rect.left - 8)}px`);
    root.style.setProperty('--tour-width', `${rect.width + 16}px`);
    root.style.setProperty('--tour-height', `${rect.height + 16}px`);
  }

  function positionCard(target, position) {
    const card = document.querySelector('#dashboardTour .dashboard-tour-card');
    const rect = target.getBoundingClientRect(); const gap = 18; const width = Math.min(360, window.innerWidth - 32);
    card.style.width = `${width}px`; card.style.left = '16px'; card.style.top = '16px';
    const height = card.offsetHeight; let left = rect.left; let top = rect.bottom + gap;
    if (position === 'right') { left = rect.right + gap; top = rect.top; }
    if (position === 'left') { left = rect.left - width - gap; top = rect.top; }
    if (position === 'top') { left = rect.left; top = rect.top - height - gap; }
    card.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
    card.style.top = `${Math.max(16, Math.min(top, window.innerHeight - height - 16))}px`;
  }

  function renderStep(index) {
    const root = document.getElementById('dashboardTour'); const steps = pageSteps[activeView] || [];
    if (!root || !active || !steps[index]) return;
    const [selector, title, text, position] = steps[index]; const target = getTarget(selector);
    if (!target) return;
    currentStep = index;
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    window.setTimeout(() => { updateSpotlight(target); positionCard(target, position); }, 120);
    root.querySelector('.dashboard-tour-kicker').textContent = `Обучение · ${pageTitles[activeView]}`;
    root.querySelector('#dashboardTourTitle').textContent = title;
    root.querySelector('#dashboardTourText').textContent = text;
    root.querySelector('.dashboard-tour-progress').textContent = `${index + 1} из ${steps.length}`;
    root.querySelector('.dashboard-tour-back').disabled = index === 0;
    root.querySelector('.dashboard-tour-next').textContent = index === steps.length - 1 ? 'Завершить' : 'Далее';
  }

  function finish(result) {
    const root = document.getElementById('dashboardTour'); active = false;
    localStorage.setItem(stateKey(activeView), result);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (root) { root.classList.remove('open'); root.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('dashboard-tour-active');
  }

  function start(mode = 'manual', requestedView) {
    if (localStorage.getItem('teamdeck-auth') !== 'logged-in') return;
    activeView = requestedView || view();
    if (!pageSteps[activeView]) activeView = 'dashboard';
    if (activeView !== view() && typeof window.nav === 'function') window.nav(activeView);
    document.getElementById('profileMenu')?.classList.remove('open');
    document.getElementById('profileTrigger')?.setAttribute('aria-expanded', 'false');
    ensureElements(); currentStep = 0; active = true;
    if (mode === 'manual') localStorage.setItem(stateKey(activeView), 'started');
    const root = document.getElementById('dashboardTour'); root.classList.add('open'); root.setAttribute('aria-hidden', 'false'); document.body.classList.add('dashboard-tour-active');
    resizeHandler = () => { const target = getTarget(pageSteps[activeView][currentStep][0]); if (target) { updateSpotlight(target); positionCard(target, pageSteps[activeView][currentStep][3]); } };
    window.addEventListener('resize', resizeHandler); window.setTimeout(() => renderStep(0), 180);
  }

  function maybeStart() {
    if (localStorage.getItem(stateKey('dashboard')) || localStorage.getItem('teamdeck-auth') !== 'logged-in' || view() !== 'dashboard') return;
    window.setTimeout(() => start('auto', 'dashboard'), 500);
  }

  window.startPlatformTour = () => start('manual', view());
  window.startDashboardTour = () => start('manual', 'dashboard');
  window.addEventListener('teamdeck:authenticated', maybeStart);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeStart, { once: true }); else window.setTimeout(maybeStart, 300);
})();
