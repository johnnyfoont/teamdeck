import { json } from '../../_lib/auth.js';

function sessionToken(request) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(';').map(value => value.trim()).find(value => value.startsWith('teamdeck_session='));
  return match ? decodeURIComponent(match.slice('teamdeck_session='.length)) : '';
}

export async function onRequestGet({ request, env }) {
  const token = sessionToken(request);
  if (!token || !env.TEAMDECK_KV) return json({ authenticated: false }, 401);
  const session = await env.TEAMDECK_KV.get(`session:${token}`, 'json');
  if (!session) return json({ authenticated: false }, 401);
  return json({ authenticated: true, profile: { name: session.name || session.email || 'Пользователь', email: session.email || '' } });
}
