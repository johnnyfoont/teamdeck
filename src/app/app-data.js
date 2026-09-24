(function () {
  'use strict';
  const isApp = location.hostname === 'app.teamdeck.space';
  if (!isApp) return;

  const state = { organization: null, departments: [], employees: [], audit: [] };
  const request = (path, options = {}) => fetch(path, { credentials: 'include', cache: 'no-store', ...options }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить данные App');
    return data;
  });

  function toCompanyDepartment(item) {
    return { id: item.id, name: item.name, lead: '', color: '#0658F6', short: item.name.slice(0, 2).toUpperCase() };
  }
  function toCompanyPerson(item) {
    return { id: item.id, name: `${item.first_name} ${item.last_name}`, role: item.job_title || 'Сотрудник', department: item.department_name || '', manager: '', email: item.email || '', phone: item.phone || '', photo: item.avatar_url || '', status: item.status === 'active' ? 'Штатный сотрудник' : item.status, startDate: item.hired_at || '', workMode: '', source: 'App', addedAt: Date.parse(item.created_at || '') || Date.now(), serverId: item.id };
  }
  function apply(data) {
    Object.assign(state, data);
    window.teamdeckAppData = state;
    if (Array.isArray(data.departments) && typeof companyDepartments !== 'undefined') {
      companyDepartments = data.departments.map(toCompanyDepartment);
      companyPeople = (data.employees || []).map(toCompanyPerson);
      if (typeof window.renderCompanyTeam === 'function') window.renderCompanyTeam();
    }
    document.documentElement.dataset.appReady = 'true';
    window.dispatchEvent(new CustomEvent('teamdeck:app-data', { detail: state }));
  }
  async function load() { apply(await request('/api/app/bootstrap')); return state; }
  window.teamdeckApp = { state, request, load, createDepartment: data => request('/api/app/departments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }), createEmployee: data => request('/api/app/employees', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }) };
  function start() { if (localStorage.getItem('teamdeck-auth') === 'logged-in') load().catch(error => console.warn('[teamdeck-app]', error.message)); }
  window.addEventListener('teamdeck:authenticated', start);
  window.addEventListener('DOMContentLoaded', start);
})();
