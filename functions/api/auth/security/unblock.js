import { json, readJson, sha256 } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { identity } = await readJson(request);
  if (!identity) return json({ error: 'Missing identity' }, 400);
  const key = await sha256(identity);
  await Promise.all([
    env.TEAMDECK_KV?.delete(`security:blocked:${key}`),
    env.TEAMDECK_KV?.delete(`security:revoked:${key}`)
  ]);
  return json({ ok: true });
}
