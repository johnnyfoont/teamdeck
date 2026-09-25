(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('auth_debug') !== '1') return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  async function run() {
    let session = { authenticated: false, error: 'Не удалось получить ответ /api/auth/session' };
    try {
      const response = await fetch('/api/auth/session?debug=1', { credentials: 'include', cache: 'no-store' });
      session = await response.json();
      session.httpStatus = response.status;
    } catch (error) { session.error = error.message || String(error); }
    const stage = params.get('stage') || 'unknown';
    const reason = params.get('reason') || 'не указана';
    const debug = session.debug || {};
    const style = document.createElement('style');
    style.textContent = '.teamdeck-auth-diagnostic{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;overflow:auto;padding:24px;background:#07101f;color:#eef4ff;font:16px/1.45 Arial,sans-serif}.teamdeck-auth-diagnostic-card{width:min(720px,100%);padding:32px;border:1px solid #31517e;border-radius:22px;background:#14243a;box-shadow:0 24px 80px #0008}.teamdeck-auth-diagnostic-brand{color:#4b8cff;font-weight:700;margin-bottom:18px}.teamdeck-auth-diagnostic h1{margin:0 0 10px;font-size:28px}.teamdeck-auth-diagnostic p{color:#aebed4}.teamdeck-auth-diagnostic dl{display:grid;grid-template-columns:190px 1fr;gap:8px 16px;margin:24px 0}.teamdeck-auth-diagnostic dt{color:#9cb0ca}.teamdeck-auth-diagnostic dd{margin:0;font-weight:600}.teamdeck-auth-diagnostic pre{padding:16px;overflow:auto;border-radius:12px;background:#091526;color:#b9d2f5;font-size:12px}.teamdeck-auth-diagnostic button{border:0;border-radius:10px;padding:12px 18px;background:#1769ff;color:#fff;font-weight:700;cursor:pointer}';
    document.head.appendChild(style);
    const card = document.createElement('section');
    card.className = 'teamdeck-auth-diagnostic';
    card.innerHTML = `<div class="teamdeck-auth-diagnostic-card"><div class="teamdeck-auth-diagnostic-brand">Teamdeck · диагностика входа</div><h1>Telegram-вход остановился</h1><p>Этот экран временный. Он показывает техническую причину, не раскрывая токены.</p><dl><dt>Этап</dt><dd>${esc(stage)}</dd><dt>Причина</dt><dd>${esc(reason)}</dd><dt>HTTP session</dt><dd>${esc(session.httpStatus || '—')}</dd><dt>Сессия</dt><dd>${session.authenticated ? 'найдена' : 'не найдена'}</dd><dt>Cookie на demo</dt><dd>${debug.hasSessionCookie ? 'есть' : 'нет'}</dd><dt>KV binding</dt><dd>${debug.hasTeamdeckKvBinding ? 'есть' : 'нет'}</dd><dt>Запись сессии в KV</dt><dd>${debug.sessionFoundInKv ? 'найдена' : 'не найдена'}</dd></dl><pre>${esc(JSON.stringify({ stage, reason, session: { authenticated: session.authenticated, debug: session.debug, error: session.error }, host: location.hostname }, null, 2))}</pre><button type="button" onclick="location.href='https://login.teamdeck.space/'">Вернуться ко входу</button></div>`;
    document.body.appendChild(card);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
}());
