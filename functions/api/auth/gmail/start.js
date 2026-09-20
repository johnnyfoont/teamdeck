import { redirect, appOrigin } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID) return new Response('Gmail OAuth is not configured', { status: 503 });
  const state = crypto.randomUUID();
  await env.TEAMDECK_KV.put(`oauth:state:${state}`, 'pending', { expirationTtl: 600 });
  const url = new URL(env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${appOrigin(request, env)}/api/auth/gmail/callback`, response_type: 'code', access_type: 'offline', prompt: 'select_account consent', include_granted_scopes: 'true', scope: 'openid email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send', state }).toString();
  return redirect(url.toString());
}
