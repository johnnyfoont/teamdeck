import { json } from '../../../_lib/auth.js';
import { sha256 } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const identity = new URL(request.url).searchParams.get('identity') || '';
  if (!identity) return json({ revoked: false });
  const key = await sha256(identity);
  const revoked = await env.TEAMDECK_KV.get(`security:revoked:${key}`, 'json');
  const blocked = await env.TEAMDECK_KV.get(`security:blocked:${key}`, 'json');
  return json({ revoked: Boolean(revoked), blocked: Boolean(blocked) });
}
