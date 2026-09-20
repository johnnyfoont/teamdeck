import { json, normalizeEmail, isEmail, randomCode, sha256, readJson, getGmailAccessToken } from '../../../_lib/auth.js';

function base64url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function rawMessage({ to, from, code }) {
  const body = `Ваш одноразовый код для входа в Teamdeck: ${code}\n\nКод действует 10 минут. Если вы не запрашивали вход, проигнорируйте это письмо.`;
  const subject = `=?UTF-8?B?${base64('Код входа в Teamdeck')}?=`;
  return [`From: Teamdeck <${from}>`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', '', body].join('\r\n');
}

export async function onRequestPost({ request, env }) {
  const { email: rawEmail } = await readJson(request);
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return json({ error: 'Введите корректный e-mail' }, 400);
  const code = randomCode();
  const key = `otp:${await sha256(email)}`;
  await env.TEAMDECK_KV.put(key, JSON.stringify({ email, codeHash: await sha256(code), createdAt: Date.now() }), { expirationTtl: 600 });
  try {
    const token = await getGmailAccessToken(env);
    const message = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw: base64url(rawMessage({ to: email, from: env.OTP_SENDER_EMAIL, code })) }) });
    if (!message.ok) throw new Error('Gmail send failed');
  } catch (error) {
    await env.TEAMDECK_KV.delete(key);
    return json({ error: 'Не удалось отправить письмо. Проверьте подключение Gmail.' }, 502);
  }
  return json({ ok: true, expiresIn: 600, message: 'Код отправлен на почту' });
}
