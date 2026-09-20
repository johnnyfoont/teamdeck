(function () {
  'use strict';

  const VIEW_KEY = 'teamdeck-active-view';
  const fallbackView = 'dashboard';

  function validView(view) {
    return view && document.getElementById(view) ? view : fallbackView;
  }

  function activateView(view, persist) {
    const target = validView(view);
    document.querySelectorAll('.views').forEach((section) => {
      section.classList.toggle('active', section.id === target);
    });
    document.querySelectorAll('#nav [data-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === target);
    });
    document.body.classList.add('app-ready');
    if (persist !== false) localStorage.setItem(VIEW_KEY, target);
    return target;
  }

  function restoreActiveView() {
    let saved = localStorage.getItem(VIEW_KEY);
    if (localStorage.getItem('teamdeck-team-nav-migrated') !== '1') {
      if (saved === 'team') saved = 'recruitment';
      localStorage.setItem('teamdeck-team-nav-migrated', '1');
    }
    return activateView(saved, false);
  }

  function refreshView(view) {
    const renderers = {
      vacancies: 'renderVacancies',
      candidates: 'renderCandidates',
      pipeline: 'renderPipeline',
      integrations: 'renderIntegrations',
      recruitment: 'renderRecruitment',
      onboarding: 'renderOnboarding',
      offboarding: 'renderOffboarding',
      team: 'renderCompanyTeam',
      analytics: 'updateAnalytics',
      settings: 'renderSettings',
    };
    const renderer = window[renderers[view]];
    if (typeof renderer !== 'function') return;
    if (view === 'analytics') renderer(document.getElementById('analyticsPeriod')?.value || 'Текущий месяц');
    else renderer();
  }

  function nav(view) {
    const target = activateView(view, true);
    refreshView(target);
    if (typeof window.replayPageAnimation === 'function') window.replayPageAnimation(target);
    return target;
  }

  function syncPreferences() {
    if (typeof window.initTheme === 'function') window.initTheme();
    if (typeof window.loadInterfacePreferences === 'function') window.loadInterfacePreferences();
  }

  function bindNavigation() {
    document.querySelectorAll('#nav [data-view]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const target = button.dataset.view;
        if (document.querySelector('.views.active')?.id === target) return;
        nav(target);
      });
    });
    const profileTrigger = document.getElementById('profileTrigger');
    if (profileTrigger && typeof window.toggleProfileMenu === 'function') {
      profileTrigger.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.toggleProfileMenu();
      };
    }
  }

  window.setActiveView = activateView;
  window.restoreActiveView = restoreActiveView;
  window.nav = nav;

  function init() {
    bindNavigation();
    restoreActiveView();
    syncPreferences();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
