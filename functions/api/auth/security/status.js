import { json } from '../../../_lib/auth.js';
import { sha256 } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const identity = new URL(request.url).searchParams.get('identity') || '';
  if (!identity) return json({ revoked: false });
  const revoked = await env.TEAMDECK_KV.get(`security:revoked:${await sha256(identity)}`, 'json');
  return json({ revoked: Boolean(revoked) });
}
