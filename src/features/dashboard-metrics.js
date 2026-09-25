(function () {
  'use strict';

  const cards = [
    { id: 'kpiVacancies', valueId: 'kVac', label: 'Открытые вакансии', view: 'vacancies', get: () => Array.isArray(window.data?.vacancies) ? window.data.vacancies.length : 0 },
    { id: 'kpiCandidates', valueId: 'kCand', label: 'Всего кандидатов', view: 'candidates', get: () => Array.isArray(window.data?.candidates) ? window.data.candidates.length : 0 },
    { id: 'kpiOnboarding', valueId: 'kOnboarding', label: 'Онбординг', view: 'onboarding', get: () => Array.isArray(window.onboardingPeople) ? window.onboardingPeople.length : 0 },
    { id: 'kpiOffboarding', valueId: 'kOffboarding', label: 'Оффбординг', view: 'offboarding', get: () => Array.isArray(window.offboardingPeople) ? window.offboardingPeople.length : 0 },
  ];

  function navigate(view) {
    const button = document.querySelector(`#nav button[data-view="${view}"]`);
    if (button) button.click();
    else if (typeof window.nav === 'function') window.nav(view);
  }

  function decorateCard(card, item) {
    if (!card || card.dataset.dashboardMetricBound === '1') return;
    card.dataset.dashboardMetricBound = '1';
    card.classList.add('dashboard-kpi-link');
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${item.label}. Открыть раздел`);
    card.addEventListener('click', () => navigate(item.view));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate(item.view);
      }
    });
  }

  function updateDashboardMetrics() {
    cards.forEach((item) => {
      const value = document.getElementById(item.valueId);
      const card = document.getElementById(item.id);
      if (value) value.textContent = String(item.get());
      decorateCard(card, item);
    });
  }

  window.updateDashboardMetrics = updateDashboardMetrics;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateDashboardMetrics, { once: true });
  else updateDashboardMetrics();
  window.addEventListener('load', updateDashboardMetrics, { once: true });
})();
