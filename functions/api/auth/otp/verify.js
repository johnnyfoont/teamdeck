import { json, normalizeEmail, isEmail, sha256, randomToken, readJson, cookie, recordSecurityEvent, isSecurityBlocked } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { email: rawEmail, code } = await readJson(request);
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email) || !/^\d{6}$/.test(String(code || ''))) return json({ error: 'Введите e-mail и шестизначный код' }, 400);
  const key = `otp:${await sha256(email)}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record || record.codeHash !== await sha256(String(code))) return json({ error: 'Код неверный или срок его действия истёк' }, 401);
  if (await isSecurityBlocked(env, email)) return json({ error: 'Этот идентификатор заблокирован администратором' }, 403);
  await env.TEAMDECK_KV.delete(key);
  const session = randomToken();
  await env.TEAMDECK_KV.put(`session:${session}`, JSON.stringify({ email, createdAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  const connectedProfile = await env.TEAMDECK_KV.get(`gmail:profile:${await sha256(email)}`, 'json');
  const profile = connectedProfile && normalizeEmail(connectedProfile.email) === email ? { name: connectedProfile.name, picture: connectedProfile.picture } : null;
  await recordSecurityEvent(env, request, { user: email, identity: email, method: 'Одноразовый код' });
  return json({ ok: true, email, profile }, 200, { 'set-cookie': cookie('teamdeck_session', session, 60 * 60 * 24 * 30) });
}
