import { json } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const state = new URL(request.url).searchParams.get('state');
  if (!state) return json({ error: 'Missing session state' }, 400);
  const key = `oauth:yandex:session:${state}`;
  const profile = await env.TEAMDECK_KV.get(key, 'json');
  if (!profile) return json({ error: 'Session expired' }, 401);
  await env.TEAMDECK_KV.delete(key);
  return json({ profile });
}
