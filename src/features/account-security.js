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
  function deviceCategory(value) { const text = String(value || '').toLowerCase(); if (/ipad|tablet|android(?!.*mobile)/i.test(text)) return 'Планшет'; if (/iphone|android.*mobile|mobile|phone/i.test(text)) return 'Смартфон'; return 'Десктоп'; }
  const deviceCategories = ['Десктоп', 'Смартфон', 'Планшет'];
  const countryCatalog = { RU: ['Россия', '🇷🇺', 'Россия и СНГ'], SK: ['Словакия', '🇸🇰', 'Европа'], DE: ['Германия', '🇩🇪', 'Европа'], FR: ['Франция', '🇫🇷', 'Европа'], GB: ['Великобритания', '🇬🇧', 'Европа'], CN: ['Китай', '🇨🇳', 'Азия'], SG: ['Сингапур', '🇸🇬', 'Азия'], JP: ['Япония', '🇯🇵', 'Азия'], US: ['США', '🇺🇸', 'Америка'], CA: ['Канада', '🇨🇦', 'Америка'], AU: ['Австралия', '🇦🇺', 'Океания'] };
  function methodLabel(value) { const text = String(value || ''); return /^(Яндекс|Yandex|Telegram|Телеграм)$/i.test(text) ? `${text} Auth` : text; }
  function countryDetails(item) { const raw = String(item.country || item.location || '').trim(); const code = raw.match(/^[A-Z]{2}$/)?.[0]; if (code && countryCatalog[code]) return { name: countryCatalog[code][0], flag: countryCatalog[code][1], region: countryCatalog[code][2] }; if (/текущее устройство/i.test(raw)) return { name: 'Россия', flag: '🇷🇺', region: 'Россия и СНГ' }; const found = Object.values(countryCatalog).find(value => raw.includes(value[0])); if (found) return { name: found[0], flag: found[1], region: found[2] }; return { name: item.country || (raw && !raw.includes('устройство') ? raw.replace(/^\S+\s+/, '') : 'Россия'), flag: item.countryFlag || '🇷🇺', region: item.region || 'Россия и СНГ' }; }
  function actionIcon(kind) { return kind === 'terminate' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7v5a4 4 0 0 0 4 4h7"/><path d="m16 13 3 3-3 3"/><path d="M5 5h5"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8 16 8-8"/></svg>'; }
  const locationCategories = ['Россия и СНГ', 'Европа', 'Азия', 'Америка', 'Океания'];
  function locationRegion(item) { return countryDetails(item).region; }
  function locationLabel(item) { const country = countryDetails(item); return `${country.flag} ${country.name}`; }
  function filteredSessions(s) {
    const query = modalQuery.toLowerCase();
    const items = s.sessions.filter(item => !query || [item.user, item.identity, item.method, item.device, item.location].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(item => modalMethod === 'all' || item.method === modalMethod)
      .filter(item => modalDevice === 'all' || deviceCategory(item.device) === modalDevice)
      .filter(item => modalLocation === 'all' || locationRegion(item) === modalLocation);
    return items.sort((a, b) => modalSort === 'oldest' ? String(a.lastSeen).localeCompare(String(b.lastSeen)) : String(b.lastSeen).localeCompare(String(a.lastSeen)));
  }
  function filteredEvents(s) {
    const query = modalQuery.toLowerCase();
    const items = s.events.filter(item => !query || [item.user, item.method, item.meta, item.title].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(item => modalMethod === 'all' || item.method === modalMethod)
      .filter(item => modalDevice === 'all' || deviceCategory(item.device || item.meta) === modalDevice)
      .filter(item => modalLocation === 'all' || locationRegion(item) === modalLocation);
    return items.sort((a, b) => modalSort === 'oldest' ? String(a.time).localeCompare(String(b.time)) : String(b.time).localeCompare(String(a.time)));
  }
  function customDropdown(key, selected, label, values) {
    const options = [{ value: 'all', label }, ...values.map(value => typeof value === 'object' ? value : ({ value, label: value }))];
    const active = options.find(option => option.value === selected) || options[0];
    return `<div class="security-custom-select"><button type="button" class="security-custom-select-trigger" aria-haspopup="listbox" aria-expanded="false" onclick="window.securityToggleDropdown(this)">${esc(active.label)}<span class="security-select-chevron" aria-hidden="true">⌄</span></button><div class="security-custom-select-menu" role="listbox">${options.map(option => `<button type="button" role="option" class="${option.value === selected ? 'is-selected' : ''}" onclick="window.securityLogSet('${key}', '${esc(option.value)}')">${option.value === selected ? '✓ ' : ''}${esc(option.label)}</button>`).join('')}</div></div>`;
  }
  function statusLabel(status) { return status === 'blocked' ? 'Заблокирована' : status === 'revoked' ? 'Неактивна' : 'Активна'; }

  function openSecurityConfirm({ title, text, actionLabel, danger, onConfirm }) {
    document.querySelector('.security-confirm-modal')?.remove();
    const modal = document.createElement('div'); modal.className = 'security-confirm-modal';
    modal.innerHTML = `<div class="security-confirm-card" role="dialog" aria-modal="true" aria-labelledby="securityConfirmTitle"><div class="security-confirm-icon ${danger ? 'danger' : ''}">${danger ? '!' : '↗'}</div><div class="security-confirm-copy"><h3 id="securityConfirmTitle">${esc(title)}</h3><p>${esc(text)}</p></div><button class="security-confirm-close" aria-label="Закрыть">×</button><div class="security-confirm-actions"><button class="btn security-confirm-cancel">Отмена</button><button class="btn ${danger ? 'security-confirm-danger' : 'security-confirm-primary'}">${esc(actionLabel)}</button></div></div>`;
    document.body.appendChild(modal); document.body.classList.add('security-confirm-open');
    const close = () => { modal.remove(); document.body.classList.remove('security-confirm-open'); document.removeEventListener('keydown', onKey); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    modal.addEventListener('click', event => { if (event.target === modal) close(); }); modal.querySelector('.security-confirm-close').onclick = close; modal.querySelector('.security-confirm-cancel').onclick = close;
    modal.querySelector('.security-confirm-primary,.security-confirm-danger').onclick = () => { close(); onConfirm(); }; document.addEventListener('keydown', onKey);
  }
  function terminate(id) {
    const itemBefore = state().sessions.find(x => x.id === id); if (!itemBefore || itemBefore.current) return;
    openSecurityConfirm({ title: 'Завершить сессию?', text: `Сессия пользователя «${itemBefore.user}» будет завершена на этом устройстве.`, actionLabel: 'Завершить', onConfirm: () => terminateConfirmed(id) });
  }
  function terminateConfirmed(id) {
    const itemBefore = state().sessions.find(x => x.id === id); if (!itemBefore) return;
    const modalWasOpen = Boolean(document.querySelector('.security-log-modal')); const modalState = { mode: modalMode, query: modalQuery, method: modalMethod, device: modalDevice, location: modalLocation, sort: modalSort };
    fetch('/api/auth/security/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: itemBefore.identity }) }).catch(() => {});
    const s = state(); const item = s.sessions.find(x => x.id === id);
    item.status = 'revoked'; item.lastSeen = 'Завершена сейчас';
    s.events.unshift({ id: `local-revoke-${Date.now()}`, type: 'revoke', title: 'Сессия завершена принудительно', user: item.user, method: item.method, time: new Date().toISOString(), meta: item.device });
    save(s); render(); if (modalWasOpen) { window.openSecurityLogs(modalState.mode); modalQuery = modalState.query; modalMethod = modalState.method; modalDevice = modalState.device; modalLocation = modalState.location; modalSort = modalState.sort; renderModal(); }
  }
  function block(identity) {
    openSecurityConfirm({ title: 'Заблокировать пользователя?', text: `Пользователь «${identity}» не сможет войти снова с этим идентификатором.`, actionLabel: 'Заблокировать', danger: true, onConfirm: () => blockConfirmed(identity) });
  }
  function blockConfirmed(identity) {
    const modalWasOpen = Boolean(document.querySelector('.security-log-modal')); const modalState = { mode: modalMode, query: modalQuery, method: modalMethod, device: modalDevice, location: modalLocation, sort: modalSort };
    fetch('/api/auth/security/block', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity }) }).catch(() => {});
    const s = state();
    if (!s.blocked.includes(identity)) s.blocked.push(identity);
    s.sessions.filter(x => x.identity === identity).forEach(x => x.status = 'blocked');
    s.events.unshift({ id: `local-block-${Date.now()}`, type: 'block', title: 'Пользователь заблокирован', user: identity, method: 'Все способы входа', time: new Date().toISOString(), meta: 'Главный аккаунт' });
    save(s); render(); if (modalWasOpen) { window.openSecurityLogs(modalState.mode); modalQuery = modalState.query; modalMethod = modalState.method; modalDevice = modalState.device; modalLocation = modalState.location; modalSort = modalState.sort; renderModal(); }
  }
  function unblock(identity) {
    const s = state(); s.blocked = s.blocked.filter(x => x !== identity);
    s.events.unshift({ id: `local-unblock-${Date.now()}`, type: 'unblock', title: 'Блокировка снята', user: identity, method: 'Управление доступом', time: new Date().toISOString(), meta: 'Главный аккаунт' });
    save(s); render();
  }

  function renderEvents(events, filter) {
    return events.filter(e => filter === 'all' || e.type === filter).map(e => `<div class="security-event"><span class="security-event-dot ${esc(e.type)}"></span><div><strong>${esc(e.title)}</strong><p>${esc(e.user)} · ${esc(methodLabel(e.method))}</p><small>${esc(e.meta)}</small></div><time>${esc(formatTime(e.time))}</time></div>`).join('') || '<div class="security-empty">Событий этого типа нет.</div>';
  }

  function render() {
    const root = document.getElementById('security'); if (!root) return;
    if (!isDemoAdmin()) { root.innerHTML = ''; return; }
    const s = state(); const active = s.sessions.filter(x => x.status === 'active'); const previewSessions = s.sessions.slice(0, 12); const previewEvents = s.events.slice(0, 12);
    root.innerHTML = `<div class="security-page"><div class="top"><div class="title"><span class="section-kicker">УПРАВЛЕНИЕ ДОСТУПОМ</span><h1>Безопасность аккаунта</h1><p>Контролируйте входы, активные сессии и блокировки пользователей.</p></div><button class="btn" onclick="nav('dashboard')">Вернуться на дашборд</button></div><div class="security-kpis"><div class="card"><span>Активные сессии</span><strong>${active.length}</strong><small>сейчас подключены</small></div><div class="card"><span>События входа</span><strong>${s.events.length}</strong><small>последние действия</small></div><div class="card"><span>Заблокированные</span><strong>${s.blocked.length}</strong><small>идентификаторов</small></div></div><div class="security-grid"><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">АКТИВНЫЕ СЕССИИ</span><h2>Кто сейчас в аккаунте</h2></div></div><div class="security-panel-note">Последние сессии · ${s.sessions.length} всего</div><div class="security-session-list">${previewSessions.map(item => `<article class="security-session ${item.status !== 'active' ? 'is-muted' : ''}"><div class="security-session-icon">${item.method === 'Telegram' ? '✈' : item.method === 'Одноразовый код' ? '✉' : '⌁'}</div><div class="security-session-main"><div><strong>${esc(item.user)}</strong>${item.current ? '<span class="security-current">Текущая</span>' : ''}</div><p>${esc(methodLabel(item.method))} · ${esc(item.device)}</p><small>${esc(locationLabel(item))} · Последняя активность: ${esc(item.lastSeen)}</small></div><div class="security-session-actions">${item.status === 'active' && !item.current ? `<button class="icon-btn security-action-btn" aria-label="Завершить сессию" title="Завершить сессию" onclick="window.securityTerminate('${esc(item.id)}')">${actionIcon('terminate')}</button>` : `<span class="security-status ${esc(item.status)}">${statusLabel(item.status)}</span>`}${!item.current && item.status === 'active' ? `<button class="icon-btn security-block-btn" aria-label="Заблокировать пользователя" title="Заблокировать пользователя" onclick="window.securityBlock('${esc(item.identity)}')">⊘</button>` : ''}</div></article>`).join('')}</div><div class="security-panel-footer"><button class="btn small" onclick="window.openSecurityLogs('sessions')">Все логи</button></div></section><section class="card security-panel"><div class="security-panel-head"><div><span class="section-kicker">ЖУРНАЛ БЕЗОПАСНОСТИ</span><h2>История действий</h2></div><select class="input security-filter" onchange="window.securityFilter(this.value)"><option value="all">Все события</option><option value="login">Входы</option><option value="revoke">Завершения</option><option value="block">Блокировки</option></select></div><div class="security-panel-note">Последние события · ${s.events.length} всего</div><div class="security-event-list" id="securityEvents">${renderEvents(previewEvents, 'all')}</div><div class="security-panel-footer"><button class="btn small" onclick="window.openSecurityLogs('events')">Все события</button></div></section></div><section class="card security-panel security-blocked-panel"><div class="security-panel-head"><div><span class="section-kicker">БЛОКИРОВКИ</span><h2>Заблокированные пользователи</h2></div></div>${s.blocked.length ? s.blocked.map(identity => `<div class="security-blocked-row"><span>${esc(identity)}</span><button class="btn small" onclick="window.securityUnblock('${esc(identity)}')">Разблокировать</button></div>`).join('') : '<div class="security-empty">Заблокированных пользователей пока нет.</div>'}</section></div>`;
    if (!remoteLoaded) loadRemoteEvents();
  }

  function renderModal() {
    const modal = document.querySelector('.security-log-modal'); if (!modal) return;
    const s = state();
    const items = modalMode === 'sessions' ? filteredSessions(s) : filteredEvents(s);
    const methods = filterValues(modalMode === 'sessions' ? s.sessions : s.events, 'method');
    const devices = deviceCategories;
    const locations = locationCategories;
    modal.innerHTML = `<div class="security-log-dialog" role="dialog" aria-modal="true" aria-label="Все логи"><div class="security-log-head"><div><span class="section-kicker">${modalMode === 'sessions' ? 'АКТИВНОСТЬ АККАУНТА' : 'ЖУРНАЛ БЕЗОПАСНОСТИ'}</span><h2>${modalMode === 'sessions' ? 'Все визиты и входы' : 'Все события'}</h2></div><button class="close" aria-label="Закрыть" onclick="window.closeSecurityLogs()">×</button></div><div class="security-log-toolbar"><input class="input" placeholder="Поиск по пользователю, способу входа…" value="${esc(modalQuery)}" oninput="window.securityLogSet('query', this.value)">${customDropdown('method', modalMethod, 'Все способы входа', methods)}${customDropdown('device', modalDevice, 'Все устройства', devices)}${customDropdown('location', modalLocation, 'Все геолокации', locations)}${customDropdown('sort', modalSort, 'Сначала новые', [{ value: 'oldest', label: 'Сначала старые' }])}</div>${modalMode === 'sessions' ? `<div class="security-log-table security-session-log-table"><div class="security-log-row security-log-header"><span>Пользователь</span><span>Способ входа</span><span>Устройство</span><span>Геолокация</span><span>Последняя активность</span><span>Действия</span></div>${items.length ? items.map(item => `<div class="security-log-row"><span><strong>${esc(item.user)}</strong>${item.current ? '<em>Текущая</em>' : ''}</span><span>${esc(methodLabel(item.method))}</span><span><b>${deviceCategory(item.device)}</b><small class="security-device-detail">${esc(item.device)}</small></span><span><b>${esc(locationLabel(item))}</b><small class="security-device-detail">${esc(locationRegion(item))}</small></span><span>${esc(item.lastSeen)}</span><span class="security-log-actions">${item.current ? '<span class="security-status active">Активна</span>' : item.status !== 'active' ? `<span class="security-status ${esc(item.status)}">${statusLabel(item.status)}</span>` : `<button class="icon-btn security-action-btn" aria-label="Завершить сессию" title="Завершить сессию" onclick="window.securityTerminate('${esc(item.id)}')">${actionIcon('terminate')}</button><button class="icon-btn security-block-btn" aria-label="Заблокировать пользователя" title="Заблокировать пользователя" onclick="window.securityBlock('${esc(item.identity)}')">${actionIcon('block')}</button>`}</span></div>`).join('') : '<div class="security-empty">По заданным параметрам визитов не найдено.</div>'}</div>` : `<div class="security-log-table"><div class="security-log-row security-log-header"><span>Дата и время</span><span>Пользователь</span><span>Событие</span><span>Способ</span><span>Устройство / регион</span></div>${items.length ? items.map(item => `<div class="security-log-row"><span>${esc(formatTime(item.time))}</span><span><strong>${esc(item.user)}</strong></span><span>${esc(item.title)}</span><span>${esc(methodLabel(item.method))}</span><span>${esc(item.meta)}</span></div>`).join('') : '<div class="security-empty">По заданным параметрам событий не найдено.</div>'}</div>`}</div>`;
  }

  async function loadRemoteEvents() {
    remoteLoaded = true;
    try {
      const response = await fetch('/api/auth/security/logs', { cache: 'no-store' });
      const payload = await response.json(); const events = Array.isArray(payload.events) ? payload.events : [];
      if (!events.length) return;
      const current = state(); const known = new Set(current.events.map(event => event.id || `${event.type}:${event.time}:${event.user}`));
      current.events = [...events.filter(event => !known.has(event.id || `${event.type}:${event.time}:${event.user}`)), ...current.events].sort((a, b) => String(b.time).localeCompare(String(a.time)));
      const remoteSessions = events.filter(event => event.type === 'login').map(event => ({ id: `remote-${event.id}`, user: event.user, identity: event.identity || event.user, method: event.method, device: event.device, location: event.location, country: event.country, countryFlag: event.countryFlag, region: event.region, lastSeen: formatTime(event.lastSeen || event.time), status: event.status || 'active' }));
      current.sessions = [...remoteSessions, ...current.sessions.filter(session => !session.id.startsWith('remote-'))]; save(current); render();
    } catch (_) {}
  }

  window.openSecurityCenter = openPage;
  window.renderSecurity = render;
  window.securityTerminate = terminate;
  window.securityBlock = block;
  window.securityUnblock = unblock;
  window.securityFilter = function (filter) { const target = document.getElementById('securityEvents'); if (target) target.innerHTML = renderEvents(state().events, filter); };
  window.openSecurityLogs = function (mode) { modalMode = mode || 'sessions'; modalQuery = ''; modalMethod = 'all'; modalDevice = 'all'; modalLocation = 'all'; modalSort = 'newest'; const root = document.getElementById('security'); if (!root) return; const modal = document.createElement('div'); modal.className = 'security-log-modal'; modal.addEventListener('click', event => { if (event.target === modal) window.closeSecurityLogs(); }); root.appendChild(modal); document.body.classList.add('security-modal-open'); renderModal(); };
  window.closeSecurityLogs = function () { document.querySelector('.security-log-modal')?.remove(); document.body.classList.remove('security-modal-open'); };
  window.securityLogSet = function (key, value) { if (key === 'query') modalQuery = value; if (key === 'method') modalMethod = value; if (key === 'device') modalDevice = value; if (key === 'location') modalLocation = value; if (key === 'sort') modalSort = value; const position = key === 'query' ? String(value).length : 0; renderModal(); if (key === 'query') { const input = document.querySelector('.security-log-toolbar input'); input?.focus(); input?.setSelectionRange(position, position); } };
  window.securityToggleDropdown = function (button) { const current = button.parentElement; document.querySelectorAll('.security-custom-select.is-open').forEach(node => { if (node !== current) { node.classList.remove('is-open'); node.querySelector('button')?.setAttribute('aria-expanded', 'false'); } }); const open = current.classList.toggle('is-open'); button.setAttribute('aria-expanded', String(open)); };
  document.addEventListener('click', event => { if (!event.target.closest('.security-custom-select')) document.querySelectorAll('.security-custom-select.is-open').forEach(node => { node.classList.remove('is-open'); node.querySelector('button')?.setAttribute('aria-expanded', 'false'); }); });
  document.addEventListener('keydown', event => { if (event.key !== 'Escape') return; const opened = document.querySelector('.security-custom-select.is-open'); if (opened) { opened.classList.remove('is-open'); opened.querySelector('button')?.setAttribute('aria-expanded', 'false'); return; } window.closeSecurityLogs(); });
})();
