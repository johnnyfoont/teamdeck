import { json } from '../../_lib/auth.js';

function sessionToken(request) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(';').map(value => value.trim()).find(value => value.startsWith('teamdeck_session='));
  return match ? decodeURIComponent(match.slice('teamdeck_session='.length)) : '';
}

export async function onRequestGet({ request, env }) {
  const token = sessionToken(request);
  const debug = new URL(request.url).searchParams.get('debug') === '1';

  if (!token || !env.TEAMDECK_KV) {
    if (debug) {
      return json({
        authenticated: false,
        debug: {
          host: new URL(request.url).hostname,
          hasSessionCookie: Boolean(token),
          hasTeamdeckKvBinding: Boolean(env.TEAMDECK_KV),
          sessionFoundInKv: false
        }
      }, 401, { 'cache-control': 'no-store' });
    }
    return json({ authenticated: false }, 401);
  }

  const session = await env.TEAMDECK_KV.get(`session:${token}`, 'json');

  if (!session) {
    if (debug) {
      return json({
        authenticated: false,
        debug: {
          host: new URL(request.url).hostname,
          hasSessionCookie: true,
          hasTeamdeckKvBinding: true,
          sessionFoundInKv: false
        }
      }, 401, { 'cache-control': 'no-store' });
    }
    return json({ authenticated: false }, 401);
  }

  return json({
    authenticated: true,
    profile: {
      name: session.name || session.email || 'Пользователь',
      email: session.email || ''
    },
    ...(debug ? {
      debug: {
        host: new URL(request.url).hostname,
        hasSessionCookie: true,
        hasTeamdeckKvBinding: true,
        sessionFoundInKv: true
      }
    } : {})
  }, 200, debug ? { 'cache-control': 'no-store' } : undefined);
}
