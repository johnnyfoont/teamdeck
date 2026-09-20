(function () {
  'use strict';

  const STORAGE_KEY = 'teamdeck-security-demo-state';
  let remoteLoaded = false;
  let modalMode = 'sessions';
  let modalQuery = '';
  let modalMethod = 'all';
  let modalDevice = 'all';
  let modalLocation = 'all';
  let modalSort = 'newest';
  const seed = {
    sessions: [
      { id: 'demo-current', user: 'Шумов Евгений', identity: 'demo', method: 'Логин и пароль', device: 'Текущий браузер · macOS', location: 'Текущее устройство', lastSeen: 'Сейчас', status: 'active', current: true },
      { id: 'otp-demo', user: 'shumov.eugene@gmail.com', identity: 'shumov.eugene@gmail.com', method: 'Одноразовый код', device: 'Safari · macOS', location: 'Россия', lastSeen: '20 сент. 2026, 20:35', status: 'active' },
      { id: 'telegram-demo', user: 'Telegram пользователь', identity: '@teamdeck_demo', method: 'Telegram', device: 'Chrome · Windows', location: 'Россия', lastSeen: '19 сент. 2026, 18:42', status: 'active' }
    ],
    events: [
      { id: 'seed-demo', type: 'login', title: 'Вход выполнен', user: 'Шумов Евгений', method: 'Логин и пароль', time: '2026-09-21T00:00:00Z', meta: 'Текущее устройство' },
      { id: 'seed-otp', type: 'login', title: 'Вход выполнен', user: 'shumov.eugene@gmail.com', method: 'Одноразовый код', time: '2026-09-20T20:35:00Z', meta: 'Safari · macOS · Россия' },
      { id: 'seed-failed', type: 'failed', title: 'Неудачная попытка входа', user: 'demo', method: 'Логин и пароль', time: '2026-09-20T19:12:00Z', meta: 'Chrome · Windows' }
    ],
    blocked: []
  };

  function state() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...seed, ...stored, sessions: stored.sessions || seed.sessions, events: stored.events || seed.events, blocked: stored.blocked || seed.blocked };
    } catch (_) { return { ...seed }; }
  }
  function save(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function esc(value) { return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function isDemoAdmin() { const method = localStorage.getItem('teamdeck-auth-method'); return localStorage.getItem('teamdeck-auth') === 'logged-in' && (!method || method === 'demo'); }
  function openPage() { if (!isDemoAdmin()) { if (typeof toast === 'function') toast('Раздел доступен только главному demo-аккаунту'); return; } if (typeof nav === 'function') nav('security'); }

  function filterValues(items, key) { return [...new Set(items.map(item => item[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ru')); }
  function filteredSessions(s) {
    const query = modalQuery.toLowerCase();
    const items = s.sessions.filter(item => !query || [item.user, item.identity, item.method, item.device, item.location].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(item => modalMethod === 'all' || item.method === modalMethod)
      .filter(item => modalDevice === 'all' || item.device === modalDevice)
      .filter(item => modalLocation === 'all' || item.location === modalLocation);
    return items.sort((a, b) => modalSort === 'oldest' ? String(a.lastSeen).localeCompare(String(b.lastSeen)) : String(b.lastSeen).localeCompare(String(a.lastSeen)));
  }
  function filteredEvents(s) {
    const query = modalQuery.toLowerCase();
    const items = s.events.filter(item => !query || [item.user, item.method, item.meta, item.title].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(item => modalMethod === 'all' || item.method === modalMethod)
      .filter(item => modalDevice === 'all' || String(item.meta || '').includes(modalDevice))
      .filter(item => modalLocation === 'all' || String(item.meta || '').includes(modalLocation));
    return items.sort((a, b) => modalSort === 'oldest' ? String(a.time).localeCompare(String(b.time)) : String(b.time).localeCompare(String(a.time)));
  }
  function selectOptions(values, selected, label) { return `<option value="all">${label}</option>${values.map(value => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}`; }
  function statusLabel(status) { return status === 'blocked' ? 'Заблокирована' : status === 'revoked' ? 'Завершена' : 'Активна'; }

  function terminate(id) {
    const s = state(); const item = s.sessions.find(x => x.id === id);
    if (!item || item.current) return;
    item.status = 'revoked'; item.lastSeen = 'Завершена сейчас';
    s.events.unshift({ id: `local-revoke-${Date.now()}`, type: 'revoke', title: 'Сессия завершена принудительно', user: item.user, method: item.method, time: new Date().toISOString(), meta: item.device });
    save(s); render(); if (document.querySelector('.security-log-modal')) renderModal();
  }
  function block(identity) {
    const s = state();
    if (!s.blocked.includes(identity)) s.blocked.push(identity);
    s.sessions.filter(x => x.identity === identity).forEach(x => x.status = 'blocked');
    s.events.unshift({ id: `local-block-${Date.now()}`, type: 'block', title: 'Пользователь заблокирован', user: identity, method: 'Все способы входа', time: new Date().toISOString(), meta: 'Главный аккаунт' });
    save(s); render(); if (document.querySelector('.security-log-modal')) renderModal();
  }
  function unblock(identity) {
    const s = state(); s.blocked = s.blocked.filter(x => x !== identity);
    s.events.unshift({ id: `local-unblock-${Date.now()}`, type: 'unblock', title: 'Блокировка снята', user: identity, method: 'Управление доступом', time: new Date().toISOString(), meta: 'Главный аккаунт' });
    save(s); render();
  }

  function renderEvents(events, filter) {
    return events.filter(e => filter === 'all' || e.type === filter).map(e => `<div class="security-event"><span class="security-event-dot ${esc(e.type)}"></span><div><strong>${esc(e.title)}</strong><p>${esc(e.user)} · ${esc(e.method)}</p><small>${esc(e.meta)}</small></div><time>${esc(formatTime(e.time))}</time></div>`).join('') || '<div class="security-empty">Событий этого типа нет.</div>';
  }

  function render() {
    const root = document.getElementById('security'); if (!root) return;
    if (!isDemoAdmin()) { root.innerHTML = ''; return; }
    const s = state(); const active = s.sessions.filter(x => x.status === 'active');
    root.innerHTML = `<div class="security-page"><div class="top"><div class="title"><span class="section-kicker">УПРАВЛЕНИЕ ДОСТУПОМ</span><h1>Безопасность аккаунта</h1><p>Контролируйте входы, активные сессии и блокировки пользователей.</p></div><button class="btn" onclick="nav('dashboard')">Вернуться на дашборд</button></div><div class="security-kpis"><div class="card"><span>Активные сессии</span><strong>${active.length}</strong><small>сейчас подключены</small></div><div class="card"><span>События входа</span><strong>${s.events.length}</strong><small>последние действия</small></div><div class="card"><span>Заблокированные</span><strong>${s.blocked.length}</strong><small>идентификаторов</small></div></div><div class="security-grid"><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">АКТИВНЫЕ СЕССИИ</span><h2>Кто сейчас в аккаунте</h2></div></div><div class="security-session-list">${s.sessions.map(item => `<article class="security-session ${item.status !== 'active' ? 'is-muted' : ''}"><div class="security-session-icon">${item.method === 'Telegram' ? '✈' : item.method === 'Одноразовый код' ? '✉' : '⌁'}</div><div class="security-session-main"><div><strong>${esc(item.user)}</strong>${item.current ? '<span class="security-current">Текущая</span>' : ''}</div><p>${esc(item.method)} · ${esc(item.device)}</p><small>${esc(item.location)} · Последняя активность: ${esc(item.lastSeen)}</small></div><div class="security-session-actions">${item.status === 'active' && !item.current ? `<button class="btn small" aria-label="Завершить сессию" title="Завершить сессию" onclick="window.securityTerminate('${esc(item.id)}')">⤨</button>` : `<span class="security-status ${esc(item.status)}">${statusLabel(item.status)}</span>`}${!item.current && item.status === 'active' ? `<button class="icon-btn security-block-btn" aria-label="Заблокировать пользователя" title="Заблокировать пользователя" onclick="window.securityBlock('${esc(item.identity)}')">⊘</button>` : ''}</div></article>`).join('')}</div><div class="security-panel-footer"><button class="btn small" onclick="window.openSecurityLogs('sessions')">Все логи</button></div></section><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">ЖУРНАЛ БЕЗОПАСНОСТИ</span><h2>История действий</h2></div><select class="input security-filter" onchange="window.securityFilter(this.value)"><option value="all">Все события</option><option value="login">Входы</option><option value="revoke">Завершения</option><option value="block">Блокировки</option></select></div><div class="security-event-list" id="securityEvents">${renderEvents(s.events, 'all')}</div><div class="security-panel-footer"><button class="btn small" onclick="window.openSecurityLogs('events')">Все логи</button></div></section></div><section class="card security-panel security-blocked-panel"><div class="security-panel-head"><div><span class="section-kicker">БЛОКИРОВКИ</span><h2>Заблокированные пользователи</h2></div></div>${s.blocked.length ? s.blocked.map(identity => `<div class="security-blocked-row"><span>${esc(identity)}</span><button class="btn small" onclick="window.securityUnblock('${esc(identity)}')">Разблокировать</button></div>`).join('') : '<div class="security-empty">Заблокированных пользователей пока нет.</div>'}</section></div>`;
    if (!remoteLoaded) loadRemoteEvents();
  }

  function renderModal() {
    const modal = document.querySelector('.security-log-modal'); if (!modal) return;
    const s = state();
    const items = modalMode === 'sessions' ? filteredSessions(s) : filteredEvents(s);
    const methods = filterValues(modalMode === 'sessions' ? s.sessions : s.events, 'method');
    const devices = filterValues(modalMode === 'sessions' ? s.sessions : s.events.map(e => ({ device: e.meta })), 'device');
    const locations = filterValues(modalMode === 'sessions' ? s.sessions : s.events.map(e => ({ location: e.meta })), 'location');
    modal.innerHTML = `<div class="security-log-dialog" role="dialog" aria-modal="true" aria-label="Все логи"><div class="security-log-head"><div><span class="section-kicker">${modalMode === 'sessions' ? 'АКТИВНОСТЬ АККАУНТА' : 'ЖУРНАЛ БЕЗОПАСНОСТИ'}</span><h2>${modalMode === 'sessions' ? 'Все визиты и входы' : 'Все события'}</h2></div><button class="close" aria-label="Закрыть" onclick="window.closeSecurityLogs()">×</button></div><div class="security-log-toolbar"><input class="input" placeholder="Поиск по пользователю, способу входа…" value="${esc(modalQuery)}" oninput="window.securityLogSet('query', this.value)"><select class="input" onchange="window.securityLogSet('method', this.value)">${selectOptions(methods, modalMethod, 'Все способы входа')}</select><select class="input" onchange="window.securityLogSet('device', this.value)">${selectOptions(devices, modalDevice, 'Все устройства')}</select><select class="input" onchange="window.securityLogSet('location', this.value)">${selectOptions(locations, modalLocation, 'Все геолокации')}</select><select class="input" onchange="window.securityLogSet('sort', this.value)"><option value="newest" ${modalSort === 'newest' ? 'selected' : ''}>Сначала новые</option><option value="oldest" ${modalSort === 'oldest' ? 'selected' : ''}>Сначала старые</option></select></div>${modalMode === 'sessions' ? `<div class="security-log-table security-session-log-table"><div class="security-log-row security-log-header"><span>Пользователь</span><span>Способ входа</span><span>Устройство</span><span>Геолокация</span><span>Последняя активность</span><span>Действия</span></div>${items.length ? items.map(item => `<div class="security-log-row"><span><strong>${esc(item.user)}</strong>${item.current ? '<em>Текущая</em>' : ''}</span><span>${esc(item.method)}</span><span>${esc(item.device)}</span><span>${esc(item.location)}</span><span>${esc(item.lastSeen)}</span><span class="security-log-actions">${item.current ? '<span class="security-status active">Активна</span>' : item.status !== 'active' ? `<span class="security-status ${esc(item.status)}">${statusLabel(item.status)}</span>` : `<button class="icon-btn" aria-label="Завершить сессию" title="Завершить сессию" onclick="window.securityTerminate('${esc(item.id)}')">⤨</button><button class="icon-btn" aria-label="Заблокировать пользователя" title="Заблокировать пользователя" onclick="window.securityBlock('${esc(item.identity)}')">⊘</button>`}</span></div>`).join('') : '<div class="security-empty">По заданным параметрам визитов не найдено.</div>'}</div>` : `<div class="security-log-table"><div class="security-log-row security-log-header"><span>Дата и время</span><span>Пользователь</span><span>Событие</span><span>Способ</span><span>Устройство / регион</span></div>${items.length ? items.map(item => `<div class="security-log-row"><span>${esc(formatTime(item.time))}</span><span><strong>${esc(item.user)}</strong></span><span>${esc(item.title)}</span><span>${esc(item.method)}</span><span>${esc(item.meta)}</span></div>`).join('') : '<div class="security-empty">По заданным параметрам событий не найдено.</div>'}</div>`}</div>`;
  }

  async function loadRemoteEvents() {
    remoteLoaded = true;
    try {
      const response = await fetch('/api/auth/security/logs', { cache: 'no-store' });
      const payload = await response.json(); const events = Array.isArray(payload.events) ? payload.events : [];
      if (!events.length) return;
      const current = state(); const known = new Set(current.events.map(event => event.id || `${event.type}:${event.time}:${event.user}`));
      current.events = [...events.filter(event => !known.has(event.id || `${event.type}:${event.time}:${event.user}`)), ...current.events].sort((a, b) => String(b.time).localeCompare(String(a.time)));
      const remoteSessions = events.filter(event => event.type === 'login' && event.status === 'active').map(event => ({ id: `remote-${event.id}`, user: event.user, identity: event.identity || event.user, method: event.method, device: event.device, location: event.location, lastSeen: formatTime(event.lastSeen || event.time), status: 'active' }));
      current.sessions = [...remoteSessions, ...current.sessions.filter(session => !session.id.startsWith('remote-'))]; save(current); render();
    } catch (_) {}
  }

  window.openSecurityCenter = openPage;
  window.renderSecurity = render;
  window.securityTerminate = terminate;
  window.securityBlock = block;
  window.securityUnblock = unblock;
  window.securityFilter = function (filter) { const target = document.getElementById('securityEvents'); if (target) target.innerHTML = renderEvents(state().events, filter); };
  window.openSecurityLogs = function (mode) { modalMode = mode || 'sessions'; modalQuery = ''; modalMethod = 'all'; modalDevice = 'all'; modalLocation = 'all'; modalSort = 'newest'; const root = document.getElementById('security'); if (!root) return; const modal = document.createElement('div'); modal.className = 'security-log-modal'; modal.addEventListener('click', event => { if (event.target === modal) window.closeSecurityLogs(); }); root.appendChild(modal); renderModal(); };
  window.closeSecurityLogs = function () { document.querySelector('.security-log-modal')?.remove(); };
  window.securityLogSet = function (key, value) { if (key === 'query') modalQuery = value; if (key === 'method') modalMethod = value; if (key === 'device') modalDevice = value; if (key === 'location') modalLocation = value; if (key === 'sort') modalSort = value; renderModal(); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape') window.closeSecurityLogs(); });
})();
