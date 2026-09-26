import { redirect, appOrigin, randomToken } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.MAILRU_CLIENT_ID || !env.MAILRU_CLIENT_SECRET) return new Response('Mail.ru OAuth is not configured', { status: 503 });
  const state = randomToken();
  await env.TEAMDECK_KV.put(`oauth:mailru:state:${state}`, '1', { expirationTtl: 600 });
  const redirectUri = `${appOrigin(request, env)}/api/auth/mailru/callback`;
  const url = new URL('https://oauth.mail.ru/login');
  url.search = new URLSearchParams({ response_type: 'code', client_id: env.MAILRU_CLIENT_ID, redirect_uri: redirectUri, scope: 'userinfo', state }).toString();
  return redirect(url.toString());
}
