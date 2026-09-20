(function () {
  'use strict';

  const STORAGE_KEY = 'teamdeck-security-demo-state';
  const seed = {
    sessions: [
      { id: 'demo-current', user: 'Шумов Евгений', identity: 'demo', method: 'Логин и пароль', device: 'Текущий браузер · macOS', location: 'Текущее устройство', lastSeen: 'Сейчас', status: 'active', current: true },
      { id: 'otp-demo', user: 'shumov.eugene@gmail.com', identity: 'shumov.eugene@gmail.com', method: 'Одноразовый код', device: 'Safari · macOS', location: 'Россия', lastSeen: '20 сент. 2026, 20:35', status: 'active' },
      { id: 'telegram-demo', user: 'Telegram пользователь', identity: '@teamdeck_demo', method: 'Telegram', device: 'Chrome · Windows', location: 'Россия', lastSeen: '19 сент. 2026, 18:42', status: 'active' }
    ],
    events: [
      { type: 'login', title: 'Вход выполнен', user: 'Шумов Евгений', method: 'Логин и пароль', time: 'Сейчас', meta: 'Текущее устройство' },
      { type: 'login', title: 'Вход выполнен', user: 'shumov.eugene@gmail.com', method: 'Одноразовый код', time: '20 сент. 2026, 20:35', meta: 'Safari · macOS · Россия' },
      { type: 'failed', title: 'Неудачная попытка входа', user: 'demo', method: 'Логин и пароль', time: '20 сент. 2026, 19:12', meta: 'Chrome · Windows' }
    ],
    blocked: []
  };

  function state() { try { return { ...seed, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch (_) { return { ...seed }; } }
  function save(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function isDemoAdmin() { const method = localStorage.getItem('teamdeck-auth-method'); return localStorage.getItem('teamdeck-auth') === 'logged-in' && (!method || method === 'demo'); }
  function esc(value) { return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function openPage() { if (!isDemoAdmin()) { if (typeof toast === 'function') toast('Раздел доступен только главному demo-аккаунту'); return; } if (typeof nav === 'function') nav('security'); }
  function terminate(id) { const s = state(); const item = s.sessions.find(x => x.id === id); if (!item || item.current) return; item.status = 'revoked'; item.lastSeen = 'Завершена сейчас'; s.events.unshift({ type: 'revoke', title: 'Сессия завершена принудительно', user: item.user, method: item.method, time: 'Сейчас', meta: item.device }); save(s); render(); }
  function block(identity) { const s = state(); if (!s.blocked.includes(identity)) s.blocked.push(identity); s.sessions.filter(x => x.identity === identity).forEach(x => x.status = 'blocked'); s.events.unshift({ type: 'block', title: 'Пользователь заблокирован', user: identity, method: 'Все способы входа', time: 'Сейчас', meta: 'Главный аккаунт' }); save(s); render(); }
  function unblock(identity) { const s = state(); s.blocked = s.blocked.filter(x => x !== identity); s.events.unshift({ type: 'unblock', title: 'Блокировка снята', user: identity, method: 'Управление доступом', time: 'Сейчас', meta: 'Главный аккаунт' }); save(s); render(); }
  function render() {
    const root = document.getElementById('security'); if (!root) return;
    if (!isDemoAdmin()) { root.innerHTML = ''; return; }
    const s = state(); const active = s.sessions.filter(x => x.status === 'active');
    root.innerHTML = `<div class="security-page"><div class="top"><div class="title"><span class="section-kicker">УПРАВЛЕНИЕ ДОСТУПОМ</span><h1>Безопасность аккаунта</h1><p>Контролируйте входы, активные сессии и блокировки пользователей.</p></div><button class="btn" onclick="nav('dashboard')">Вернуться на дашборд</button></div><div class="security-kpis"><div class="card"><span>Активные сессии</span><strong>${active.length}</strong><small>сейчас подключены</small></div><div class="card"><span>События входа</span><strong>${s.events.length}</strong><small>последние действия</small></div><div class="card"><span>Заблокированные</span><strong>${s.blocked.length}</strong><small>идентификаторов</small></div></div><div class="security-grid"><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">АКТИВНЫЕ СЕССИИ</span><h2>Кто сейчас в аккаунте</h2></div><button class="btn danger-soft" onclick="window.securityEndOthers()">Завершить остальные</button></div><div class="security-session-list">${s.sessions.map(item => `<article class="security-session ${item.status !== 'active' ? 'is-muted' : ''}"><div class="security-session-icon">${item.method === 'Telegram' ? '✈' : item.method === 'Одноразовый код' ? '✉' : '⌁'}</div><div class="security-session-main"><div><strong>${esc(item.user)}</strong>${item.current ? '<span class="security-current">Текущая</span>' : ''}</div><p>${esc(item.method)} · ${esc(item.device)}</p><small>${esc(item.location)} · Последняя активность: ${esc(item.lastSeen)}</small></div><div class="security-session-actions">${item.status === 'active' && !item.current ? `<button class="btn small" onclick="window.securityTerminate('${esc(item.id)}')">Завершить</button>` : `<span class="security-status ${item.status}">${item.status === 'blocked' ? 'Заблокирована' : item.status === 'revoked' ? 'Завершена' : 'Активна'}</span>`}${!item.current && item.status === 'active' ? `<button class="icon-btn security-block-btn" title="Заблокировать пользователя" onclick="window.securityBlock('${esc(item.identity)}')">⊘</button>` : ''}</div></article>`).join('')}</div></section><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">ЖУРНАЛ БЕЗОПАСНОСТИ</span><h2>История действий</h2></div><select class="input security-filter" onchange="window.securityFilter(this.value)"><option value="all">Все события</option><option value="login">Входы</option><option value="revoke">Завершения</option><option value="block">Блокировки</option></select></div><div class="security-event-list" id="securityEvents">${renderEvents(s.events, 'all')}</div></section></div><section class="card security-panel security-blocked-panel"><div class="security-panel-head"><div><span class="section-kicker">БЛОКИРОВКИ</span><h2>Заблокированные пользователи</h2></div></div>${s.blocked.length ? s.blocked.map(identity => `<div class="security-blocked-row"><span>${esc(identity)}</span><button class="btn small" onclick="window.securityUnblock('${esc(identity)}')">Разблокировать</button></div>`).join('') : '<div class="security-empty">Заблокированных пользователей пока нет.</div>'}</section></div>`;
  }
  function renderEvents(events, filter) { return events.filter(e => filter === 'all' || e.type === filter).map(e => `<div class="security-event"><span class="security-event-dot ${e.type}"></span><div><strong>${esc(e.title)}</strong><p>${esc(e.user)} · ${esc(e.method)}</p><small>${esc(e.meta)}</small></div><time>${esc(e.time)}</time></div>`).join('') || '<div class="security-empty">Событий этого типа нет.</div>'; }
  window.openSecurityCenter = openPage;
  window.renderSecurity = render;
  window.securityTerminate = terminate;
  window.securityBlock = block;
  window.securityUnblock = unblock;
  window.securityEndOthers = function () { state().sessions.filter(x => x.status === 'active' && !x.current).forEach(x => terminate(x.id)); };
  window.securityFilter = function (filter) { const target = document.getElementById('securityEvents'); if (target) target.innerHTML = renderEvents(state().events, filter); };
})();
