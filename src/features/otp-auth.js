(function () {
  'use strict';

  let requestedEmail = '';
  let codeRequested = false;

  function form() { return document.querySelector('.auth-form'); }
  function errorNode() { return document.getElementById('authError'); }
  function statusNode() { return document.getElementById('otpStatus'); }
  function setError(message) { const node = errorNode(); if (node) node.textContent = message || ''; }
  function setStatus(message) { const node = statusNode(); if (node) node.textContent = message || ''; }
  function savedEmail() { return localStorage.getItem('teamdeck-auth-email') || ''; }
  function savedProfile() { try { return JSON.parse(localStorage.getItem('teamdeck-auth-profile') || 'null'); } catch (_) { return null; } }
  function isOtpSession() { return localStorage.getItem('teamdeck-auth-method') === 'otp'; }

  function renderOtpForm(prefill = savedEmail()) {
    const target = form();
    if (!target) return;
    requestedEmail = prefill || '';
    codeRequested = false;
    target.innerHTML = `<div class="field"><label for="loginUsername">E-mail</label><input class="input" id="loginUsername" type="email" autocomplete="email" placeholder="name@company.com" value="${prefill.replace(/"/g, '&quot;')}" required></div><div class="field otp-code-field" hidden><label for="loginCode">Одноразовый код</label><input class="input" id="loginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 цифр"></div><div class="otp-status" id="otpStatus" aria-live="polite"></div><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" id="otpSubmit" type="submit">Получить код</button><button class="auth-link otp-resend" id="otpResend" type="button" hidden>Отправить новый код</button><button class="auth-link" id="demoLoginLink" type="button">Войти с логином и паролем</button>`;
    target.onsubmit = event => { event.preventDefault(); codeRequested ? verifyCode() : requestCode(); };
    document.getElementById('otpResend').addEventListener('click', requestCode);
    document.getElementById('demoLoginLink').addEventListener('click', showDemoLogin);
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
      syncProfile(data.profile || { name: data.email });
      showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated')); if (typeof toast === 'function') toast('Добро пожаловать в Teamdeck');
    } catch (error) { submit.disabled = false; submit.textContent = 'Войти'; setError(error.message); }
  }

  function syncProfile(profile) {
    const name = profile?.name || savedEmail() || 'Евгений Шумов';
    const picture = profile?.picture || 'assets/profile/default-avatar.svg';
    document.querySelectorAll('#profileTrigger b, #profileMenu .profile-menu-head b').forEach(node => { node.textContent = name; });
    document.querySelectorAll('#profileTrigger img').forEach(node => { node.src = picture; node.alt = name; });
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
    }
    if (typeof originalLogin === 'function') originalLogin();
    if (username === 'demo' && password === 'demo') syncProfile({ name: 'Евгений Шумов' });
  };
  window.logoutUser = function () {
    const email = localStorage.getItem('teamdeck-auth-email') || '';
    if (typeof originalLogout === 'function') originalLogout();
    localStorage.removeItem('teamdeck-auth-profile');
    localStorage.removeItem('teamdeck-auth-method');
    localStorage.removeItem('teamdeck-auth-email');
    renderOtpForm(email);
    syncProfile({ name: 'Евгений Шумов' });
  };

  window.initOtpAuth = renderOtpForm;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { renderOtpForm(); syncProfile(isOtpSession() ? (savedProfile() || { name: savedEmail() }) : { name: 'Евгений Шумов' }); });
  else { renderOtpForm(); syncProfile(isOtpSession() ? (savedProfile() || { name: savedEmail() }) : { name: 'Евгений Шумов' }); }
  if (new URLSearchParams(location.search).get('gmail') === 'connected') setTimeout(() => setStatus('Gmail подключён. Теперь можно запросить код.'), 0);
}());
