(function () {
  'use strict';

  let requestedEmail = '';
  let codeRequested = false;

  function form() { return document.querySelector('.auth-form'); }
  function errorNode() { return document.getElementById('authError'); }
  function setError(message) { const node = errorNode(); if (node) node.textContent = message || ''; }

  function renderOtpForm() {
    const target = form();
    if (!target) return;
    target.innerHTML = `<div class="field"><label for="loginUsername">E-mail</label><input class="input" id="loginUsername" type="email" autocomplete="email" placeholder="name@company.com" required></div><div class="field otp-code-field" hidden><label for="loginCode">Одноразовый код</label><input class="input" id="loginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 цифр"></div><div class="auth-error" id="authError" role="alert"></div><button class="btn primary auth-submit" id="otpSubmit" type="submit">Получить код</button><button class="auth-link otp-resend" id="otpResend" type="button" hidden>Отправить новый код</button><button class="auth-link" type="button" onclick="location.href='/api/auth/gmail/start'">Подключить Gmail для отправки кодов</button><button class="auth-link" type="button" onclick="loginDemoMode()">Войти в демо-режим</button>`;
    target.onsubmit = event => { event.preventDefault(); codeRequested ? verifyCode() : requestCode(); };
    document.getElementById('otpResend').addEventListener('click', requestCode);
  }

  async function requestCode() {
    const email = document.getElementById('loginUsername').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Введите корректный e-mail'); return; }
    setError('');
    const submit = document.getElementById('otpSubmit'); submit.disabled = true; submit.textContent = 'Отправляем…';
    try {
      const response = await fetch('/api/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить код');
      requestedEmail = email; codeRequested = true;
      document.querySelector('.otp-code-field').hidden = false;
      document.getElementById('loginCode').focus();
      document.getElementById('otpResend').hidden = false;
      submit.disabled = false; submit.textContent = 'Войти';
      setError('Код отправлен на почту. Он действует 10 минут.');
    } catch (error) { submit.disabled = false; submit.textContent = codeRequested ? 'Войти' : 'Получить код'; setError(error.message); }
  }

  async function verifyCode() {
    const code = document.getElementById('loginCode').value.trim();
    if (!/^\d{6}$/.test(code)) { setError('Введите шестизначный код'); return; }
    const submit = document.getElementById('otpSubmit'); submit.disabled = true; submit.textContent = 'Проверяем…'; setError('');
    try {
      const response = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: requestedEmail || document.getElementById('loginUsername').value, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Код не принят');
      localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-auth-email', data.email); localStorage.setItem('teamdeck-active-view', 'dashboard');
      document.getElementById('loginPassword')?.remove();
      showApp(); if (typeof goHome === 'function') goHome(); window.dispatchEvent(new Event('teamdeck:authenticated')); if (typeof toast === 'function') toast('Добро пожаловать в Teamdeck');
    } catch (error) { submit.disabled = false; submit.textContent = 'Войти'; setError(error.message); }
  }

  window.loginDemoMode = function () { localStorage.setItem('teamdeck-auth', 'logged-in'); localStorage.setItem('teamdeck-active-view', 'dashboard'); showApp(); if (typeof goHome === 'function') goHome(); if (typeof toast === 'function') toast('Демо-режим активирован'); };
  window.initOtpAuth = renderOtpForm;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderOtpForm); else renderOtpForm();
  if (new URLSearchParams(location.search).get('gmail') === 'connected') setTimeout(() => setError('Gmail подключён. Теперь можно запросить код.'), 0);
}());
