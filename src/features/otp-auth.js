(function () {
  'use strict';

  let requestedEmail = '';
  let codeRequested = false;
  let sessionMonitor;
  let blockedMonitor;
  const DEMO_SESSION_VERSION = '2026-09-20-reset-3';

  function form() { return document.querySelector('.auth-form'); }
  function errorNode() { return document.getElementById('authError'); }
  function statusNode() { return document.getElementById('otpStatus'); }
  function setError(message) { const node = errorNode(); if (node) node.textContent = message || ''; }
  function setStatus(message) { const node = statusNode(); if (node) node.textContent = message || ''; }
  function clientDeviceCategory() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    if (/ipad|tablet/i.test(ua) || (/macintosh/i.test(ua + ' ' + platform) && touchPoints > 1)) return 'tablet';
    if (/iphone|android.*mobile|mobile|phone/i.test(ua)) return 'smartphone';
    return 'desktop';
  }
  function savedEmail() { return localStorage.getItem('teamdeck-auth-email') || ''; }
  function loginLanguage() {
    const query = new URLSearchParams(location.search).get('lang');
    if (query === 'en' || query === 'ru') {
      try { const current = JSON.parse(localStorage.getItem('teamdeck-interface-preferences') || '{}'); localStorage.setItem('teamdeck-interface-preferences', JSON.stringify({ ...current, language: query })); } catch (_) {}
      return query;
    }
    try { return JSON.parse(localStorage.getItem('teamdeck-interface-preferences') || '{}').language === 'en' ? 'en' : 'ru'; } catch (_) { return 'ru'; }
  }
  function loginText(ru, en) { return loginLanguage() === 'en' ? en : ru; }
  function loginLanguageControl() {
    const lang = loginLanguage();
    return `<div id="authLanguageSwitch" class="auth-language-switch" role="group" aria-label="${loginText('Язык интерфейса','Interface language')}"><button type="button" class="auth-language-option ${lang === 'ru' ? 'active' : ''}" onclick="setLoginLanguage('ru')">RU</button><button type="button" class="auth-language-option ${lang === 'en' ? 'active' : ''}" onclick="setLoginLanguage('en')">EN</button></div>`;
  }
  window.setLoginLanguage = function (language) {
    const next = language === 'en' ? 'en' : 'ru';
    try { const current = JSON.parse(localStorage.getItem('teamdeck-interface-preferences') || '{}'); localStorage.setItem('teamdeck-interface-preferences', JSON.stringify({ ...current, language: next })); } catch (_) { localStorage.setItem('teamdeck-interface-preferences', JSON.stringify({ language: next })); }
    location.reload();
  };
  function mountLoginLanguageControl() {
    const screen = document.getElementById('authScreen');
    if (!screen) return;
    screen.querySelector('#authLanguageSwitch')?.remove();
    screen.insertAdjacentHTML('beforeend', loginLanguageControl());
  }
  function applyLoginChrome() {
    const en = loginLanguage() === 'en';
    const screen = document.getElementById('authScreen');
    const title = screen?.querySelector('.auth-brand h1');
    const subtitle = screen?.querySelector('.auth-brand p');
    const legal = screen?.querySelector('.auth-legal');
    if (screen) screen.setAttribute('aria-label', en ? 'Sign in to Teamdeck' : 'Вход в Teamdeck');
    if (title) title.textContent = en ? 'Sign in to Teamdeck' : 'Вход в Teamdeck';
    if (subtitle) subtitle.textContent = en ? 'Manage hiring and your team in one place' : 'Управляйте наймом и командой в одном месте';
    if (legal) legal.innerHTML = en ? `By continuing, you agree to the <a href="#" onclick="event.preventDefault();toast('Privacy policy will be added later')">privacy policy</a> and Teamdeck terms of use.` : `Продолжая, вы соглашаетесь с <a href="#" onclick="event.preventDefault();toast('Политика конфиденциальности будет добавлена позже')">политикой конфиденциальности</a> и условиями использования Teamdeck.`;
  }
  const isTeamdeckDomain = /(^|\.)teamdeck\.space$/i.test(location.hostname);
  const isDemoDomain = location.hostname === 'demo.teamdeck.space';
  function rememberLoginTarget() { localStorage.removeItem('teamdeck-login-target'); }
  function setCrossDomainSession(profile, method) {
    if (!isTeamdeckDomain || isDemoDomain) return;
    // Authentication is shared by the HttpOnly teamdeck_session cookie.
    // Remove the legacy client-readable cross-domain cookies so they cannot
    // participate in routing or restore a stale local session.
    document.cookie = 'teamdeck_cross_auth=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax';
    document.cookie = 'teamdeck_cross_method=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax';
    document.cookie = 'teamdeck_cross_profile=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax';
    const params = new URLSearchParams(location.search);
    const rawReturn = params.get('return') || '/dashboard';
    const returnPath = rawReturn.startsWith('/') && !rawReturn.startsWith('//') ? rawReturn : '/dashboard';
    const destination = 'https://demo.teamdeck.space';
    document.cookie = 'teamdeck_login_target=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax';
    localStorage.removeItem('teamdeck-login-target');
    localStorage.removeItem('teamdeck-auth');
    localStorage.removeItem('teamdeck-auth-method');
    localStorage.removeItem('teamdeck-auth-profile');
    localStorage.removeItem('teamdeck-auth-email');
    window.location.replace(destination + returnPath);
  }
  function hydrateCrossDomainSession() {
    if (!isDemoDomain || localStorage.getItem('teamdeck-auth') === 'logged-in') return;
    const cookies = Object.fromEntries(document.cookie.split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(pair => pair[0]));
    if (cookies.teamdeck_cross_auth !== '1') return;
    localStorage.setItem('teamdeck-auth', 'logged-in');
    localStorage.setItem('teamdeck-auth-method', cookies.teamdeck_cross_method || 'external');
    if ((cookies.teamdeck_cross_method || '') === 'demo') localStorage.setItem('teamdeck-demo-session-version', DEMO_SESSION_VERSION);
    if (cookies.teamdeck_cross_profile) {
      try { localStorage.setItem('teamdeck-auth-profile', cookies.teamdeck_cross_profile); } catch (_) {}
    }
    localStorage.setItem('teamdeck-active-view', 'dashboard');
  }
  async function hydrateServerSession() {
    if (!isDemoDomain || localStorage.getItem('teamdeck-auth') === 'logged-in') return;
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.authenticated || !data.profile) return;
      localStorage.setItem('teamdeck-auth', 'logged-in');
      localStorage.setItem('teamdeck-auth-method', 'external');
      localStorage.setItem('teamdeck-auth-email', data.profile.email || '');
      localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      localStorage.setItem('teamdeck-active-view', 'dashboard');
    } catch (_) {}
  }
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
    document.documentElement.classList.remove('auth-bootstrap-pending');
    requestedEmail = prefill || '';
    codeRequested = false;
    applyLoginChrome();
    mountLoginLanguageControl();
    target.noValidate = true;
    target.innerHTML = `<div class="field"><label for="loginUsername">${loginText('E-mail','E-mail')}</label><input class="input" id="loginUsername" type="text" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="name@company.com" value="${prefill.replace(/"/g, '&quot;')}" required></div><div class="field otp-code-field" hidden><label for="loginCode">${loginText('Одноразовый код','One-time code')}</label><input class="input" id="loginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${loginText('6 цифр','6 digits')}"></div><div class="otp-status" id="otpStatus" aria-live="polite"></div><a class="auth-link gmail-reconnect" id="gmailReconnect" href="/api/auth/gmail/start" hidden>Переподключить Gmail</a><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" id="otpSubmit" type="submit">${loginText('Получить код','Get code')}</button><button class="auth-link otp-resend" id="otpResend" type="button" hidden>${loginText('Отправить новый код','Send a new code')}</button><button class="auth-link" id="demoLoginLink" type="button">${loginText('Войти с логином и паролем','Sign in with username and password')}</button><div class="auth-divider"><span>${loginText('или войти через','or continue with')}</span></div><div class="external-auth-grid"><button class="external-auth-btn external-auth-yandex" type="button" onclick="startExternalLogin('yandex')"><img src="assets/auth/yandex.png" alt="Яндекс"><span>Яндекс</span></button><button class="external-auth-btn external-auth-mail" type="button" onclick="startExternalLogin('mailru')"><img src="assets/auth/mailru.png" alt="Mail.ru"><span>Mail.ru</span></button><button class="external-auth-btn external-auth-telegram" type="button" onclick="startExternalLogin('telegram')"><img src="assets/auth/telegram.png" alt="Telegram"><span>Telegram</span></button></div>`;
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
    let authStage = 'подготовка авторизации';
    try {
      authStage = 'отправка данных Telegram';
      const response = await fetch('/api/auth/telegram/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-teamdeck-device': clientDeviceCategory() }, body: JSON.stringify(user) });
      authStage = 'получение ответа сервера';
      const raw = await response.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (_) {
        throw new Error('Сервер авторизации вернул некорректный ответ (HTTP ' + response.status + ')');
      }
      authStage = 'проверка ответа сервера';
      if (!response.ok || !data.profile) throw new Error(data.detail || data.error || 'Не удалось проверить вход через Telegram');
      if (data.redirectUrl) {
        authStage = 'переход в демо';
        // Use an actual anchor navigation instead of window.location/window.open:
        // Safari can throw a generic DOMException for invalid navigation strings.
        const handoffUrl = String(data.redirectUrl || '');
        if (!/^https:\/\/demo\.teamdeck\.space\//i.test(handoffUrl)) throw new Error('Некорректный адрес перехода после авторизации');
        const link = document.createElement('a');
        link.href = handoffUrl;
        link.target = '_top';
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-auth-method', 'telegram'); localStorage.setItem('teamdeck-auth-email', data.profile.email); localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      syncProfile(data.profile, 'external'); syncSecurityMenu(); startSessionMonitor(); setCrossDomainSession(data.profile, 'telegram'); showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated'));
    } catch (error) { if (/заблокирован/i.test(error.message)) showBlockedScreen(user?.username ? `${user.username}@telegram.local` : 'Telegram аккаунт'); else if (/Telegram login data expired/i.test(error.message)) { document.getElementById('telegram-login-widget')?.remove(); setError('Срок действия данных Telegram истёк. Нажмите кнопку Telegram ещё раз.'); } else setError(error.message); }
  };

  async function finishExternalLogin() {
    const params = new URLSearchParams(location.search);
    if (params.get('blocked') === '1') { showBlockedScreen(params.get('identity') || 'Yandex аккаунт'); history.replaceState({}, '', location.hostname === 'login.teamdeck.space' ? '/' : '/login'); return; }
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
      setCrossDomainSession(data.profile, 'yandex'); showApp(); if (typeof goHome === 'function') goHome();
      window.dispatchEvent(new Event('teamdeck:authenticated'));
    } catch (error) { if (/заблокирован/i.test(error.message)) showBlockedScreen(savedEmail() || 'Yandex аккаунт'); else setError(error.message); }
  }

  function showDemoLogin() {
    const target = form();
    if (!target) return;
    document.documentElement.classList.remove('auth-bootstrap-pending');
    applyLoginChrome();
    mountLoginLanguageControl();
    target.innerHTML = `<div class="field"><label for="loginUsername">${loginText('Логин','Username')}</label><input class="input" id="loginUsername" autocomplete="username" placeholder="${loginText('Введите логин','Enter username')}"></div><div class="field"><label for="loginPassword">${loginText('Пароль','Password')}</label><input class="input" id="loginPassword" type="password" autocomplete="current-password" placeholder="${loginText('Введите пароль','Enter password')}"></div><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" type="submit">${loginText('Войти','Sign in')}</button><button class="auth-link" id="otpLoginLink" type="button">${loginText('Войти по e-mail и коду','Sign in with e-mail and code')}</button>`;
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
      if (!response.ok) { if (data.action === 'reconnect_gmail') document.getElementById('gmailReconnect')?.removeAttribute('hidden'); throw new Error(data.error || 'Не удалось отправить код'); }
      requestedEmail = email; codeRequested = true;
      document.querySelector('.otp-code-field').hidden = false;
      document.getElementById('loginCode').addEventListener('input', updateVerifyButton);
      document.getElementById('otpResend').hidden = false;
      submit.disabled = true; submit.textContent = loginText('Войти','Sign in');
      setStatus(loginText('Код отправлен на почту. Он действует 10 минут.','The code was sent to your email. It is valid for 10 minutes.'));
      document.getElementById('loginCode').focus();
    } catch (error) { submit.disabled = false; submit.textContent = loginText('Получить код','Get code'); setError(error.message); }
  }

  function updateVerifyButton() {
    const input = document.getElementById('loginCode');
    const submit = document.getElementById('otpSubmit');
    if (input && submit) submit.disabled = !/^\d{6}$/.test(input.value.trim());
  }

  async function verifyCode() {
    const code = document.getElementById('loginCode').value.trim();
    if (!/^\d{6}$/.test(code)) return;
    const submit = document.getElementById('otpSubmit'); submit.disabled = true; submit.textContent = loginText('Проверяем…','Checking…'); setError('');
    try {
      const response = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-teamdeck-device': clientDeviceCategory() }, body: JSON.stringify({ email: requestedEmail || document.getElementById('loginUsername').value, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Код не принят');
      localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-auth-method', 'otp'); localStorage.setItem('teamdeck-auth-email', data.email); localStorage.setItem('teamdeck-active-view', 'dashboard');
      if (data.profile) localStorage.setItem('teamdeck-auth-profile', JSON.stringify(data.profile));
      else localStorage.removeItem('teamdeck-auth-profile');
      syncProfile(data.profile || { name: data.email }, 'otp'); startSessionMonitor();
      setCrossDomainSession(data.profile || { name: data.email, email: data.email }, 'otp');
      showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated')); if (typeof toast === 'function') toast('Добро пожаловать в Teamdeck');
    } catch (error) { submit.disabled = false; submit.textContent = loginText('Войти','Sign in'); if (/заблокирован/i.test(error.message)) showBlockedScreen(email); else setError(error.message); }
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
    document.documentElement.classList.remove('auth-bootstrap-pending');
    clearInterval(sessionMonitor); clearInterval(blockedMonitor); document.body.classList.add('auth-minimal');
    localStorage.setItem('teamdeck-blocked-state', identity || 'blocked');
    localStorage.removeItem('teamdeck-auth'); localStorage.removeItem('teamdeck-auth-method'); localStorage.removeItem('teamdeck-auth-profile'); localStorage.removeItem('teamdeck-auth-email');
    const app = document.querySelector('.app'); if (app) app.style.display = 'none';
    const screen = document.getElementById('authScreen'); if (!screen) return;
    screen.classList.add('open', 'blocked-screen');
    const label = String(identity || 'Ваш аккаунт').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]));
    screen.innerHTML = `<div class="blocked-card"><div class="blocked-mark">!</div><span class="section-kicker">ДОСТУП ОГРАНИЧЕН</span><h1>Аккаунт заблокирован</h1><p>Администратор ограничил доступ к платформе для этого идентификатора. Вход, просмотр данных и повторная авторизация недоступны.</p><div class="blocked-identity"><span>${label}</span><button class="blocked-copy-button" type="button" aria-label="Скопировать идентификатор" title="Скопировать идентификатор" onclick="window.copyBlockedIdentity(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16V6a2 2 0 0 1 2-2h10"/></svg></button></div><div class="blocked-actions"><a class="btn primary" href="mailto:support@teamdeck.ru?subject=Запрос на разблокировку аккаунта">Написать в поддержку</a><a class="btn blocked-secondary" href="mailto:support@teamdeck.ru?subject=Вопрос по блокировке аккаунта">Связаться по e-mail</a></div><small>Укажите этот идентификатор в обращении — так поддержка быстрее найдёт запись.</small></div>`;
    hideFloatingWidgets();
    blockedMonitor = setInterval(async () => { try { const response = await fetch('/api/auth/security/status?identity=' + encodeURIComponent(identity), { cache: 'no-store' }); const data = await response.json(); if (!data.blocked) { clearInterval(blockedMonitor); localStorage.removeItem('teamdeck-blocked-state'); document.body.classList.remove('auth-minimal'); window.location.reload(); } } catch (_) {} }, 5000);
  }
  function hideFloatingWidgets() { if (!document.body.classList.contains('auth-minimal')) return; document.querySelectorAll('body *').forEach(node => { if (node.closest('.auth-screen,.auth-card,.blocked-card')) return; const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); if (style.position === 'fixed' && rect.width <= 100 && rect.height <= 100 && rect.right > window.innerWidth - 120 && rect.bottom > window.innerHeight - 120) node.style.setProperty('display', 'none', 'important'); }); }
  window.copyBlockedIdentity = function (button) { const identity = button.closest('.blocked-identity')?.querySelector('span')?.textContent || ''; navigator.clipboard?.writeText(identity).then(() => { const original = button.innerHTML; button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'; button.classList.add('copied'); button.title = 'Скопировано'; setTimeout(() => { button.innerHTML = original; button.classList.remove('copied'); button.title = 'Скопировать идентификатор'; }, 1400); }).catch(() => {}); };
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
    if (username === 'demo' && password === 'demo') { syncProfile(demoProfile, 'demo'); syncSecurityMenu(); setCrossDomainSession(demoProfile, 'demo'); }
  };
  window.logoutUser = function () {
    clearInterval(sessionMonitor);
    if (isTeamdeckDomain) { document.cookie = 'teamdeck_cross_auth=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax'; document.cookie = 'teamdeck_cross_method=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax'; document.cookie = 'teamdeck_cross_profile=; Domain=.teamdeck.space; Path=/; Max-Age=0; Secure; SameSite=Lax'; }
    document.body.classList.add('auth-minimal');
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
  async function initOtpAuth() {
    rememberLoginTarget();
    await hydrateServerSession();
    // Server session is the single source of truth for cross-domain authentication.
    // The legacy teamdeck_cross_* cookies are intentionally ignored.
    // Signal bootstrap.js only after server auth hydration is complete.
    window.teamdeckAuthHydrated = true;
    window.dispatchEvent(new Event('teamdeck:auth-hydrated'));
    const blockedIdentity = localStorage.getItem('teamdeck-blocked-state');
    if (blockedIdentity) { showBlockedScreen(blockedIdentity); return; }
    const invalidated = invalidateOldDemoSession();
    renderOtpForm();
    if (localStorage.getItem('teamdeck-auth') !== 'logged-in') { document.body.classList.add('auth-minimal'); hideFloatingWidgets(); setTimeout(hideFloatingWidgets, 250); setTimeout(hideFloatingWidgets, 1000); }
    const external = isOtpSession() || isExternalSession();
    if (localStorage.getItem('teamdeck-auth') === 'logged-in') showApp();
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
