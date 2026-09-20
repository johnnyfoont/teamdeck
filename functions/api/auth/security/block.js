import { json, readJson, sha256, recordSecurityEvent } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { identity } = await readJson(request);
  if (!identity) return json({ error: 'Missing identity' }, 400);
  const key = await sha256(identity);
  const record = JSON.stringify({ identity, blockedAt: Date.now() });
  await env.TEAMDECK_KV.put(`security:blocked:${key}`, record, { expirationTtl: 60 * 60 * 24 * 365 });
  await env.TEAMDECK_KV.put(`security:revoked:${key}`, record, { expirationTtl: 60 * 60 * 24 * 365 });
  await recordSecurityEvent(env, request, { type: 'block', title: 'Пользователь заблокирован', user: identity, identity, method: 'Управление доступом', device: 'Панель безопасности' });
  return json({ ok: true });
}
