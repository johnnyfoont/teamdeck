import { getSessionUser, body, json, unauthorized, sendEmail } from '../../_lib/app.js';
import { randomCode } from '../../_lib/auth.js';

function clean(value) { return String(value || '').trim().toLowerCase(); }
export async function onRequestPost({ request, env }) {
  const auth = await getSessionUser(request, env);
  if (!auth) return unauthorized();
  const data = await body(request);
  const email = clean(data.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Укажите корректный e-mail для выставления счёта' }, 400);
  const code = randomCode();
  await env.TEAMDECK_KV.put(`billing_email_code:${auth.userId}:${email}`, JSON.stringify({ code, email }), { expirationTtl: 600 });
  try {
    await sendEmail(env, { to: email, subject: 'Код подтверждения Teamdeck', text: `Ваш код подтверждения e-mail для выставления счёта Teamdeck: ${code}\n\nКод действует 10 минут.` });
  } catch (_) {
    return json({ error: 'Не удалось отправить письмо. Почтовый сервис ещё не подключён к App-preview.', code: 'EMAIL_NOT_CONFIGURED' }, 503);
  }
  return json({ ok: true, email, message: `Код подтверждения отправлен на ${email}` });
}

export async function onRequestPut({ request, env }) {
  const auth = await getSessionUser(request, env);
  if (!auth) return unauthorized();
  const data = await body(request);
  const email = clean(data.email); const code = String(data.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return json({ error: 'Введите шестизначный код' }, 400);
  const key = `billing_email_code:${auth.userId}:${email}`;
  const stored = await env.TEAMDECK_KV.get(key, 'json');
  if (!stored || stored.code !== code) return json({ error: 'Неверный или истёкший код подтверждения' }, 400);
  await env.TEAMDECK_KV.delete(key);
  await env.TEAMDECK_KV.put(`billing_email_verified:${auth.userId}`, JSON.stringify({ email, verifiedAt: new Date().toISOString() }), { expirationTtl: 86400 });
  return json({ ok: true, email, verified: true });
}
