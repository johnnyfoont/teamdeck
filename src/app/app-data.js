(function () {
  'use strict';
  const isApp = location.hostname === 'app.teamdeck.space' || /(^|\.)teamdeck-app-preview\.pages\.dev$/i.test(location.hostname);
  if (!isApp) return;

  const state = { organization: null, departments: [], employees: [], audit: [], access: null };
  const appShell = () => document.querySelector('.app');
  function hideAppShell() { appShell()?.style.setProperty('display', 'none', 'important'); }
  function showAppShell() { appShell()?.style.removeProperty('display'); }
  hideAppShell();
  const request = (path, options = {}) => fetch(path, { credentials: 'include', cache: 'no-store', ...options }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Не удалось загрузить данные App'); error.code = data.code; error.status = response.status; throw error; }
    return data;
  });

  function toCompanyDepartment(item) { return { id: item.id, name: item.name, lead: '', color: '#0658F6', short: item.name.slice(0, 2).toUpperCase() }; }
  function toCompanyPerson(item) { return { id: item.id, name: `${item.first_name} ${item.last_name}`, role: item.job_title || 'Сотрудник', department: item.department_name || '', manager: '', email: item.email || '', phone: item.phone || '', photo: item.avatar_url || '', status: item.status === 'active' ? 'Штатный сотрудник' : item.status, startDate: item.hired_at || '', workMode: '', source: 'App', addedAt: Date.parse(item.created_at || '') || Date.now(), serverId: item.id }; }
  function apply(data) {
    Object.assign(state, data);
    showAppShell();
    window.teamdeckAppData = state;
    if (Array.isArray(data.departments) && typeof companyDepartments !== 'undefined') {
      companyDepartments = data.departments.map(toCompanyDepartment);
      companyPeople = (data.employees || []).map(toCompanyPerson);
      if (typeof window.renderCompanyTeam === 'function') window.renderCompanyTeam();
    }
    document.documentElement.dataset.appReady = 'true';
    window.dispatchEvent(new CustomEvent('teamdeck:app-data', { detail: state }));
  }
  function escapeHtml(value) { return String(value || '').replace(/[&<>\"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[char])); }
  function showSetupGate() {
    hideAppShell();
    if (document.getElementById('appAccessGate')) return;
    const gate = document.createElement('section'); gate.id = 'appAccessGate'; gate.className = 'app-access-gate';
    gate.innerHTML = `<div class="app-access-card"><div class="app-access-brand">Teamdeck</div><h1>Настройте рабочее пространство</h1><p class="app-access-lead">Для App нужна организация с подтверждённым доступом. Demo-кабинет и рабочие данные разделены.</p><form id="appOrgForm"><div class="app-form-grid"><label>ИНН<input id="appOrgInn" inputmode="numeric" maxlength="12" placeholder="10 или 12 цифр" required></label><button class="btn" id="appLookupInn" type="button">Найти организацию</button><label class="wide">Название организации<input id="appOrgName" placeholder="Заполнится после поиска" required></label><label>КПП<input id="appOrgKpp" inputmode="numeric" maxlength="9"></label><label>Юридический адрес<input id="appOrgAddress"></label><label>Почта для счёта<input id="appBillingEmail" type="email" required></label><label class="wide">Тариф<select id="appPlan"></select></label></div><div id="appLookupResult" class="app-access-hint"></div><div id="appAccessError" class="app-access-error" role="alert"></div><div class="app-access-actions"><button class="btn primary" type="submit">Создать организацию и запросить счёт</button><button class="auth-link" id="appAccessLogout" type="button">Выйти</button></div></form></div>`;
    document.body.appendChild(gate);
    const email = localStorage.getItem('teamdeck-auth-email') || ''; document.getElementById('appBillingEmail').value = email;
    loadPlans();
    document.getElementById('appLookupInn').onclick = lookupInn;
    document.getElementById('appOrgForm').onsubmit = createOrgAndInvoice;
    document.getElementById('appAccessLogout').onclick = () => typeof logoutUser === 'function' && logoutUser();
  }
  async function loadPlans() { try { const data = await request('/api/app/plans'); document.getElementById('appPlan').innerHTML = (data.plans || []).map(plan => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} — ${plan.price_minor ? (plan.price_minor / 100).toLocaleString('ru-RU') + ' ₽/мес.' : 'по запросу'}</option>`).join(''); } catch (error) { setGateError(error.message); } }
  async function lookupInn() {
    const inn = document.getElementById('appOrgInn').value.trim(); const result = document.getElementById('appLookupResult');
    result.textContent = 'Ищем организацию…';
    try { const data = await request('/api/app/company-lookup?inn=' + encodeURIComponent(inn)); const first = data.results?.[0]; if (!first) { result.textContent = 'Организация не найдена.'; return; } document.getElementById('appOrgName').value = first.name || ''; document.getElementById('appOrgKpp').value = first.kpp || ''; document.getElementById('appOrgAddress').value = first.address || ''; result.textContent = `Найдено: ${first.name}. Статус: ${first.status || 'не указан'}.`; } catch (error) { result.textContent = error.message; }
  }
  function setGateError(message) { const node = document.getElementById('appAccessError'); if (node) node.textContent = message; }
  async function createOrgAndInvoice(event) {
    event.preventDefault(); setGateError('');
    const data = { name: document.getElementById('appOrgName').value, legalName: document.getElementById('appOrgName').value, inn: document.getElementById('appOrgInn').value, kpp: document.getElementById('appOrgKpp').value, legalAddress: document.getElementById('appOrgAddress').value, billingEmail: document.getElementById('appBillingEmail').value };
    try { const org = await request('/api/app/organizations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); const invoice = await request('/api/app/invoices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: document.getElementById('appPlan').value, ...data }) }); document.querySelector('#appOrgForm').innerHTML = `<div class="app-access-success"><h2>Заявка создана</h2><p>Организация ${escapeHtml(org.name)} зарегистрирована. Заявка на счёт ${escapeHtml(invoice.number)} направлена на ${escapeHtml(invoice.billingEmail)}.</p><p>После подтверждения оплаты рабочее пространство станет доступным.</p></div>`; } catch (error) { setGateError(error.message); }
  }
  async function load() { apply(await request('/api/app/bootstrap')); return state; }
  window.teamdeckApp = { state, request, load, createDepartment: data => request('/api/app/departments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }), createEmployee: data => request('/api/app/employees', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }) };
  async function start() { try { await load(); } catch (error) { if (error.code === 'APP_ACCESS_REQUIRED' || error.status === 401 || error.status === 403) showSetupGate(); else { hideAppShell(); console.warn('[teamdeck-app]', error.message); } } }
  window.addEventListener('teamdeck:authenticated', start);
  window.addEventListener('DOMContentLoaded', start);
})();
