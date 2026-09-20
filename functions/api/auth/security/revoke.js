import { json, readJson, sha256 } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { identity } = await readJson(request);
  if (!identity) return json({ error: 'Missing identity' }, 400);
  await env.TEAMDECK_KV.put(`security:revoked:${await sha256(identity)}`, JSON.stringify({ identity, revokedAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ ok: true });
}
