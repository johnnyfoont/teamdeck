(function () {
  'use strict';

  let requestedEmail = '';
  let codeRequested = false;
  let sessionMonitor;
  const DEMO_SESSION_VERSION = '2026-09-20-reset-3';

  function form() { return document.querySelector('.auth-form'); }
  function errorNode() { return document.getElementById('authError'); }
  function statusNode() { return document.getElementById('otpStatus'); }
  function setError(message) { const node = errorNode(); if (node) node.textContent = message || ''; }
  function setStatus(message) { const node = statusNode(); if (node) node.textContent = message || ''; }
  function savedEmail() { return localStorage.getItem('teamdeck-auth-email') || ''; }
  function savedProfile() { try { return JSON.parse(localStorage.getItem('teamdeck-auth-profile') || 'null'); } catch (_) { return null; } }
  function authMethod() { return localStorage.getItem('teamdeck-auth-method') || ''; }
  function isOtpSession() { return authMethod() === 'otp'; }
  function isExternalSession() { return ['telegram', 'yandex', 'mailru', 'external'].includes(authMethod()); }
  const demoProfile = { name: 'Шумов Евгений', picture: 'assets/profile/evgeny-shumov.jpg' };

  function invalidateOldDemoSession() {
    if (localStorage.getItem('teamdeck-auth-method') !== 'demo') return false;
    if (localStorage.getItem('teamdeck-demo-session-version') === DEMO_SESSION_VERSION) return false;
    localStorage.removeItem('teamdeck-auth');
    localStorage.removeItem('teamdeck-auth-method');
    localStorage.removeItem('teamdeck-auth-profile');
    localStorage.removeItem('teamdeck-auth-email');
    localStorage.setItem('teamdeck-demo-session-version', DEMO_SESSION_VERSION);
    return true;
  }

  function renderOtpForm(prefill = savedEmail()) {
    const target = form();
    if (!target) return;
    requestedEmail = prefill || '';
    codeRequested = false;
    target.innerHTML = `<div class="field"><label for="loginUsername">E-mail</label><input class="input" id="loginUsername" type="email" autocomplete="email" placeholder="name@company.com" value="${prefill.replace(/"/g, '&quot;')}" required></div><div class="field otp-code-field" hidden><label for="loginCode">Одноразовый код</label><input class="input" id="loginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 цифр"></div><div class="otp-status" id="otpStatus" aria-live="polite"></div><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" id="otpSubmit" type="submit">Получить код</button><button class="auth-link otp-resend" id="otpResend" type="button" hidden>Отправить новый код</button><button class="auth-link" id="demoLoginLink" type="button">Войти с логином и паролем</button><div class="auth-divider"><span>или войти через</span></div><div class="external-auth-grid"><button class="external-auth-btn external-auth-yandex" type="button" onclick="startExternalLogin('yandex')"><img src="assets/auth/yandex.png" alt="Яндекс"><span>Яндекс</span></button><button class="external-auth-btn external-auth-mail" type="button" onclick="startExternalLogin('mailru')"><img src="assets/auth/mailru.png" alt="Mail.ru"><span>Mail.ru</span></button><button class="external-auth-btn external-auth-telegram" type="button" onclick="startExternalLogin('telegram')"><img src="assets/auth/telegram.png" alt="Telegram"><span>Telegram</span></button></div>`;
    target.onsubmit = event => { event.preventDefault(); codeRequested ? verifyCode() : requestCode(); };
    document.getElementById('otpResend').addEventListener('click', requestCode);
    document.getElementById('demoLoginLink').addEventListener('click', showDemoLogin);
  }

  window.startExternalLogin = function (provider) {
    const labels = { yandex: 'Яндекс', mailru: 'Mail.ru', telegram: 'Telegram' };
    if (provider === 'yandex') { window.location.href = '/api/auth/yandex/start'; return; }
    if (provider === 'telegram') {
      const existing = document.getElementById('telegram-login-widget');
      if (existing) { existing.hidden = false; return; }
      const host = document.querySelector('.external-auth-grid');
      if (!host) return;
      const wrapper = document.createElement('div'); wrapper.id = 'telegram-login-widget'; wrapper.className = 'telegram-login-widget';
      host.insertAdjacentElement('afterend', wrapper);
      const script = document.createElement('script'); script.async = true; script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.dataset.telegramLogin = 'teamdeck_login_bot'; script.dataset.size = 'medium'; script.dataset.userpic = 'false'; script.dataset.requestAccess = 'write'; script.dataset.onauth = 'onTelegramAuth(user)';
      wrapper.appendChild(script); setStatus('Откройте Telegram и подтвердите вход.'); return;
    }
    setError('Авторизация через ' + (labels[provider] || provider) + ' будет подключена после настройки приложения провайдера.');
  };

  window.onTelegramAuth = async function (user) {
    try {
      const response = await fetch('/api/auth/telegram/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(user) });
      const data = await response.json();
      if (!response.ok || !data.profile) throw new Error(data.error || 'Не удалось проверить вход через Telegram');
      localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-auth-method', 'telegram'); localStorage.setItem('teamdeck-auth-email', data.profile.email); localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      syncProfile(data.profile, 'external'); syncSecurityMenu(); startSessionMonitor(); showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated'));
    } catch (error) { if (/заблокирован/i.test(error.message)) showBlockedScreen(user?.username ? `${user.username}@telegram.local` : 'Telegram аккаунт'); else setError(error.message); }
  };

  async function finishExternalLogin() {
    const params = new URLSearchParams(location.search);
    if (params.get('blocked') === '1') { showBlockedScreen(params.get('identity') || 'Yandex аккаунт'); history.replaceState({}, '', '/login'); return; }
    if (params.get('external') !== 'yandex' || !params.get('state')) return;
    try {
      const response = await fetch('/api/auth/yandex/session?state=' + encodeURIComponent(params.get('state')), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.profile) throw new Error(data.error || 'Не удалось получить профиль Яндекса');
      localStorage.setItem('teamdeck-auth', 'logged-in');
      localStorage.setItem('teamdeck-auth-method', 'yandex');
      localStorage.setItem('teamdeck-auth-email', data.profile.email);
      localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      syncProfile(data.profile, 'external'); syncSecurityMenu(); startSessionMonitor();
      history.replaceState({}, '', '/dashboard');
      showApp(); if (typeof goHome === 'function') goHome();
      window.dispatchEvent(new Event('teamdeck:authenticated'));
    } catch (error) { if (/заблокирован/i.test(error.message)) showBlockedScreen(savedEmail() || 'Yandex аккаунт'); else setError(error.message); }
  }

  function showDemoLogin() {
    const target = form();
    if (!target) return;
    target.innerHTML = `<div class="field"><label for="loginUsername">Логин</label><input class="input" id="loginUsername" autocomplete="username" placeholder="Введите логин"></div><div class="field"><label for="loginPassword">Пароль</label><input class="input" id="loginPassword" type="password" autocomplete="current-password" placeholder="Введите пароль"></div><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" type="submit">Войти</button><button class="auth-link" id="otpLoginLink" type="button">Войти по e-mail и коду</button>`;
    target.onsubmit = event => { event.preventDefault(); if (typeof window.loginUser === 'function') window.loginUser(); };
    document.getElementById('otpLoginLink').addEventListener('click', () => renderOtpForm(savedEmail()));
    document.getElementById('loginUsername').focus();
  }

  async function requestCode() {
    const email = document.getElementById('loginUsername').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Введите корректный e-mail'); return; }
    setError(''); setStatus('');
    const submit = document.getElementById('otpSubmit'); submit.disabled = true; submit.textContent = 'Отправляем…';
    try {
      const response = await fetch('/api/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить код');
      requestedEmail = email; codeRequested = true;
      document.querySelector('.otp-code-field').hidden = false;
      document.getElementById('loginCode').addEventListener('input', updateVerifyButton);
      document.getElementById('otpResend').hidden = false;
      submit.disabled = true; submit.textContent = 'Войти';
      setStatus('Код отправлен на почту. Он действует 10 минут.');
      document.getElementById('loginCode').focus();
    } catch (error) { submit.disabled = false; submit.textContent = 'Получить код'; setError(error.message); }
  }

  function updateVerifyButton() {
    const input = document.getElementById('loginCode');
    const submit = document.getElementById('otpSubmit');
    if (input && submit) submit.disabled = !/^\d{6}$/.test(input.value.trim());
  }

  async function verifyCode() {
    const code = document.getElementById('loginCode').value.trim();
    if (!/^\d{6}$/.test(code)) return;
    const submit = document.getElementById('otpSubmit'); submit.disabled = true; submit.textContent = 'Проверяем…'; setError('');
    try {
      const response = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: requestedEmail || document.getElementById('loginUsername').value, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Код не принят');
      localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-auth-method', 'otp'); localStorage.setItem('teamdeck-auth-email', data.email); localStorage.setItem('teamdeck-active-view', 'dashboard');
      if (data.profile) localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      else localStorage.removeItem('teamdeck-auth-profile');
      syncProfile(data.profile || { name: data.email }, 'otp'); startSessionMonitor();
      showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated')); if (typeof toast === 'function') toast('Добро пожаловать в Teamdeck');
    } catch (error) { submit.disabled = false; submit.textContent = 'Войти'; if (/заблокирован/i.test(error.message)) showBlockedScreen(email); else setError(error.message); }
  }

  function syncProfile(profile, mode = isOtpSession() ? 'otp' : 'demo') {
    const name = profile?.name || savedEmail() || 'Евгений Шумов';
    const picture = profile?.picture || 'assets/profile/default-avatar.svg';
    document.querySelectorAll('#profileTrigger b, #profileMenu .profile-menu-head b').forEach(node => { node.textContent = name; });
    document.querySelectorAll('#profileTrigger img').forEach(node => { node.src = picture; node.alt = name; });
    document.querySelectorAll('#profileTrigger small, #profileMenu .profile-menu-head small').forEach(node => { node.textContent = mode === 'demo' ? 'CEO' : ''; node.style.display = mode === 'demo' ? '' : 'none'; });
  }
  function syncSecurityMenu() {
    const item = document.getElementById('securityMenuItem');
    if (item) item.style.display = (!authMethod() || authMethod() === 'demo') ? '' : 'none';
  }
  function showBlockedScreen(identity = savedEmail()) {
    clearInterval(sessionMonitor);
    localStorage.setItem('teamdeck-blocked-state', identity || 'blocked');
    localStorage.removeItem('teamdeck-auth'); localStorage.removeItem('teamdeck-auth-method'); localStorage.removeItem('teamdeck-auth-profile'); localStorage.removeItem('teamdeck-auth-email');
    const app = document.querySelector('.app'); if (app) app.style.display = 'none';
    const screen = document.getElementById('authScreen'); if (!screen) return;
    screen.classList.add('open', 'blocked-screen');
    const label = String(identity || 'Ваш аккаунт').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
    screen.innerHTML = `<div class="blocked-card"><div class="blocked-mark">!</div><span class="section-kicker">ДОСТУП ОГРАНИЧЕН</span><h1>Аккаунт заблокирован</h1><p>Администратор ограничил доступ к платформе для этого идентификатора. Вход, просмотр данных и повторная авторизация недоступны.</p><div class="blocked-identity">${label}</div><div class="blocked-actions"><a class="btn primary" href="mailto:support@teamdeck.ru?subject=Запрос на разблокировку аккаунта">Написать в поддержку</a><a class="btn blocked-secondary" href="mailto:support@teamdeck.ru?subject=Вопрос по блокировке аккаунта">Связаться по e-mail</a></div><small>Укажите этот идентификатор в обращении — так поддержка быстрее найдёт запись.</small></div>`;
  }
  function startSessionMonitor() {
    clearInterval(sessionMonitor);
    if (!isOtpSession() && !isExternalSession()) return;
    const identity = savedProfile()?.email || savedEmail();
    if (!identity) return;
    const check = async () => {
      try {
        const response = await fetch('/api/auth/security/status?identity=' + encodeURIComponent(identity), { cache: 'no-store' });
        const data = await response.json();
        if (data.blocked) { showBlockedScreen(identity); return; }
        if (data.revoked) { clearInterval(sessionMonitor); window.logoutUser(); if (typeof window.showLoginScreen === 'function') window.showLoginScreen(); }
      } catch (_) {}
    };
    sessionMonitor = setInterval(check, 10000);
  }

  const originalLogout = window.logoutUser;
  const originalLogin = window.loginUser;
  window.loginUser = function () {
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value || '';
    if (username === 'demo' && password === 'demo') {
      localStorage.removeItem('teamdeck-auth-profile');
      localStorage.removeItem('teamdeck-auth-email');
      localStorage.setItem('teamdeck-auth-method', 'demo');
      localStorage.setItem('teamdeck-demo-session-version', DEMO_SESSION_VERSION);
    }
    if (typeof originalLogin === 'function') originalLogin();
    if (username === 'demo' && password === 'demo') { syncProfile(demoProfile, 'demo'); syncSecurityMenu(); }
  };
  window.logoutUser = function () {
    clearInterval(sessionMonitor);
    const email = localStorage.getItem('teamdeck-auth-email') || '';
    if (typeof originalLogout === 'function') originalLogout();
    localStorage.removeItem('teamdeck-auth-profile');
    localStorage.removeItem('teamdeck-auth-method');
    localStorage.removeItem('teamdeck-auth-email');
    renderOtpForm(email);
    syncProfile(demoProfile, 'demo');
    syncSecurityMenu();
  };

  window.initOtpAuth = renderOtpForm;
  function initOtpAuth() {
    const blockedIdentity = localStorage.getItem('teamdeck-blocked-state');
    if (blockedIdentity) { showBlockedScreen(blockedIdentity); return; }
    const invalidated = invalidateOldDemoSession();
    renderOtpForm();
    const external = isOtpSession() || isExternalSession();
    syncProfile(external ? (savedProfile() || { name: savedEmail() }) : demoProfile, external ? authMethod() : 'demo');
    syncSecurityMenu();
    startSessionMonitor();
    if (invalidated && typeof window.showLoginScreen === 'function') window.showLoginScreen();
    finishExternalLogin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initOtpAuth);
  else initOtpAuth();
  if (new URLSearchParams(location.search).get('gmail') === 'connected') setTimeout(() => setStatus('Gmail подключён. Теперь можно запросить код.'), 0);
}());
