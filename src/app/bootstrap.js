(function () {
  'use strict';

  const VIEW_KEY = 'teamdeck-active-view';
  const DEMO_SESSION_VERSION = '2026-09-20-reset-3';
  const fallbackView = 'dashboard';
  const routes = {
    dashboard: '/dashboard',
    vacancies: '/vacancies',
    candidates: '/candidates',
    pipeline: '/pipeline',
    onboarding: '/onboarding',
    team: '/team',
    offboarding: '/offboarding',
    analytics: '/analytics',
    integrations: '/integrations',
    recruitment: '/recruitment',
    settings: '/settings',
    security: '/security',
  };
  const viewsByPath = Object.fromEntries(Object.entries(routes).map(([view, path]) => [path, view]));

  function validView(view) {
    return view && document.getElementById(view) ? view : fallbackView;
  }

  function viewFromLocation() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return validView(viewsByPath[path] || (path === '/' ? null : fallbackView));
  }

  function pathForView(view) {
    return routes[validView(view)] || routes[fallbackView];
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
      security: 'renderSecurity',
    };
    const renderer = window[renderers[view]];
    if (typeof renderer !== 'function') return;
    if (view === 'analytics') renderer(document.getElementById('analyticsPeriod')?.value || 'Текущий месяц');
    else renderer();
  }

  function syncUrl(view, mode) {
    const url = pathForView(view);
    if (window.location.pathname !== url) window.history[mode]({ view }, '', url);
  }

  function showView(view, options = {}) {
    const profileMenu = document.getElementById('profileMenu');
    const profileTrigger = document.getElementById('profileTrigger');
    profileMenu?.classList.remove('open');
    profileTrigger?.classList.remove('is-open');
    profileTrigger?.setAttribute('aria-expanded', 'false');
    const target = activateView(view, options.persist !== false);
    if (options.updateUrl !== false) syncUrl(target, options.replace ? 'replaceState' : 'pushState');
    try { refreshView(target); } catch (error) { console.error('Teamdeck view renderer failed:', target, error); }
    try { if (typeof window.replayPageAnimation === 'function') window.replayPageAnimation(target); } catch (error) { console.error('Teamdeck page animation failed:', target, error); }
    return target;
  }

  function restoreActiveView() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    let saved = viewsByPath[path] || (path === '/' ? localStorage.getItem(VIEW_KEY) : fallbackView);
    if (localStorage.getItem('teamdeck-team-nav-migrated') !== '1') {
      if (saved === 'team') saved = 'recruitment';
      localStorage.setItem('teamdeck-team-nav-migrated', '1');
    }
    const target = showView(saved || fallbackView, { persist: true, replace: true, updateUrl: true });
    if (path === '/' || path !== pathForView(target)) syncUrl(target, 'replaceState');
    return target;
  }

  function nav(view) {
    return showView(view, { persist: true, updateUrl: true });
  }

  function syncPreferences() {
    if (typeof window.initTheme === 'function') window.initTheme();
    if (typeof window.loadInterfacePreferences === 'function') window.loadInterfacePreferences();
  }

  function enforceAuthentication() {
    const authMethod = localStorage.getItem('teamdeck-auth-method');
    const isLegacyDemoSession = localStorage.getItem('teamdeck-auth') === 'logged-in' && !authMethod;
    if ((authMethod === 'demo' || isLegacyDemoSession) && localStorage.getItem('teamdeck-demo-session-version') !== DEMO_SESSION_VERSION) {
      localStorage.removeItem('teamdeck-auth');
      localStorage.removeItem('teamdeck-auth-method');
      localStorage.removeItem('teamdeck-auth-profile');
      localStorage.removeItem('teamdeck-auth-email');
      localStorage.setItem('teamdeck-demo-session-version', DEMO_SESSION_VERSION);
    }
    if (localStorage.getItem('teamdeck-auth') !== 'logged-in' && typeof window.showLoginScreen === 'function') {
      window.showLoginScreen();
    }
  }

  function bindNavigation() {
    document.querySelectorAll('#nav [data-view]').forEach((button) => {
      button.onclick = null;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = button.dataset.view;
        if (document.querySelector('.views.active')?.id === target) {
          syncUrl(target, 'replaceState');
          return;
        }
        nav(target);
      });
    });
    window.addEventListener('popstate', () => {
      showView(viewFromLocation(), { persist: true, updateUrl: false });
    });
    const profileTrigger = document.getElementById('profileTrigger');
    if (profileTrigger && typeof window.toggleProfileMenu === 'function') {
      profileTrigger.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.toggleProfileMenu();
      };
    }
    const profileMenu = document.getElementById('profileMenu');
    const profileLauncher = document.querySelector('.profile-launcher');
    const closeProfileMenu = () => {
      if (!profileMenu) return;
      profileMenu.classList.remove('open');
      profileTrigger?.classList.remove('is-open');
      profileTrigger?.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('click', (event) => {
      if (profileLauncher && !profileLauncher.contains(event.target)) closeProfileMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeProfileMenu();
    });
  }

  window.setActiveView = activateView;
  window.restoreActiveView = restoreActiveView;
  window.nav = nav;
  window.teamdeckRoutes = routes;

  function init() {
    bindNavigation();
    restoreActiveView();
    syncPreferences();
    enforceAuthentication();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
