(function () {
  'use strict';

  const TOUR_STATE_KEY = 'teamdeck-dashboard-tour-state';
  const steps = [
    { target: '#dashboard .title', title: 'Дашборд', text: 'Здесь собран главный обзор процесса найма: текущие показатели, события и последние изменения в команде.', position: 'bottom' },
    { target: '#dashboard .approval-button', title: 'Согласования', text: 'В этом разделе CEO видит запросы на удаление кандидатов и может принимать решения по ним.', position: 'bottom' },
    { target: '#dashboard .grid.kpis', title: 'Ключевые показатели', text: 'Верхние карточки показывают текущий объём вакансий, кандидатов, интервью и найма.', position: 'bottom' },
    { target: '#dashboard .grid:not(.kpis) > .section:first-child', title: 'Воронка найма', text: 'Следите, сколько кандидатов находится на каждом этапе — от отклика до выхода на работу.', position: 'right' },
    { target: '#dashboard .grid:not(.kpis) > .section:nth-child(2)', title: 'Ближайшие события', text: 'Здесь отображаются запланированные интервью, скрининги и другие важные события команды.', position: 'left' },
    { target: '#dashboard .dashboard-grid', title: 'Эффективность и активность', text: 'Эти блоки помогают быстро оценить скорость работы команды и динамику последних дней.', position: 'top' },
    { target: '#dashboard .dashboard-updates', title: 'Последние обновления', text: 'В нижней части дашборда хранится краткая история действий по кандидатам, вакансиям и команде.', position: 'top' },
  ];

  let currentStep = 0;
  let active = false;
  let resizeHandler;

  function setState(value) { localStorage.setItem(TOUR_STATE_KEY, value); }

  function ensureElements() {
    if (document.getElementById('dashboardTour')) return;
    const root = document.createElement('div');
    root.id = 'dashboardTour';
    root.className = 'dashboard-tour';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="dashboard-tour-backdrop"></div><div class="dashboard-tour-card" role="dialog" aria-modal="true" aria-labelledby="dashboardTourTitle"><div class="dashboard-tour-kicker">Обучение · Дашборд</div><h2 id="dashboardTourTitle"></h2><p id="dashboardTourText"></p><div class="dashboard-tour-footer"><span class="dashboard-tour-progress"></span><div class="dashboard-tour-actions"><button type="button" class="dashboard-tour-skip">Пропустить</button><button type="button" class="dashboard-tour-back">Назад</button><button type="button" class="btn primary dashboard-tour-next">Далее</button></div></div></div>';
    document.body.appendChild(root);
    root.querySelector('.dashboard-tour-backdrop').addEventListener('click', () => finish('skipped'));
    root.querySelector('.dashboard-tour-skip').addEventListener('click', () => finish('skipped'));
    root.querySelector('.dashboard-tour-back').addEventListener('click', () => renderStep(currentStep - 1));
    root.querySelector('.dashboard-tour-next').addEventListener('click', () => currentStep >= steps.length - 1 ? finish('completed') : renderStep(currentStep + 1));
  }

  function positionCard(target, position) {
    const card = document.querySelector('#dashboardTour .dashboard-tour-card');
    const rect = target.getBoundingClientRect();
    const gap = 18;
    const cardWidth = Math.min(360, window.innerWidth - 32);
    card.style.width = `${cardWidth}px`;
    card.style.left = '16px'; card.style.top = '16px';
    const height = card.offsetHeight;
    let left = rect.left; let top = rect.bottom + gap;
    if (position === 'right') { left = rect.right + gap; top = rect.top; }
    if (position === 'left') { left = rect.left - cardWidth - gap; top = rect.top; }
    if (position === 'top') { left = rect.left; top = rect.top - height - gap; }
    card.style.left = `${Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16))}px`;
    card.style.top = `${Math.max(16, Math.min(top, window.innerHeight - height - 16))}px`;
  }

  function renderStep(index) {
    const root = document.getElementById('dashboardTour');
    if (!root || !active || !steps[index]) return;
    const step = steps[index];
    const target = document.querySelector(step.target);
    if (!target) return;
    currentStep = index;
    const rect = target.getBoundingClientRect();
    root.style.setProperty('--tour-top', `${Math.max(8, rect.top - 8)}px`);
    root.style.setProperty('--tour-left', `${Math.max(8, rect.left - 8)}px`);
    root.style.setProperty('--tour-width', `${rect.width + 16}px`);
    root.style.setProperty('--tour-height', `${rect.height + 16}px`);
    root.querySelector('#dashboardTourTitle').textContent = step.title;
    root.querySelector('#dashboardTourText').textContent = step.text;
    root.querySelector('.dashboard-tour-progress').textContent = `${index + 1} из ${steps.length}`;
    root.querySelector('.dashboard-tour-back').disabled = index === 0;
    root.querySelector('.dashboard-tour-next').textContent = index === steps.length - 1 ? 'Завершить' : 'Далее';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    window.setTimeout(() => positionCard(target, step.position), 80);
  }

  function finish(result) {
    const root = document.getElementById('dashboardTour');
    active = false; setState(result);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (root) { root.classList.remove('open'); root.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('dashboard-tour-active');
  }

  function start(mode) {
    if (localStorage.getItem('teamdeck-auth') !== 'logged-in') return;
    if (typeof window.nav === 'function' && document.querySelector('.views.active')?.id !== 'dashboard') window.nav('dashboard');
    document.getElementById('profileMenu')?.classList.remove('open');
    document.getElementById('profileTrigger')?.setAttribute('aria-expanded', 'false');
    ensureElements(); currentStep = 0; active = true;
    if (mode === 'manual') setState('started');
    const root = document.getElementById('dashboardTour');
    root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dashboard-tour-active');
    resizeHandler = () => renderStep(currentStep);
    window.addEventListener('resize', resizeHandler);
    window.setTimeout(() => renderStep(0), 180);
  }

  function maybeStart() {
    if (localStorage.getItem(TOUR_STATE_KEY) || localStorage.getItem('teamdeck-auth') !== 'logged-in') return;
    if (document.querySelector('.views.active')?.id !== 'dashboard') return;
    window.setTimeout(() => start('auto'), 500);
  }

  window.startDashboardTour = (mode = 'manual') => start(mode);
  window.addEventListener('teamdeck:authenticated', maybeStart);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeStart, { once: true });
  else window.setTimeout(maybeStart, 300);
})();
