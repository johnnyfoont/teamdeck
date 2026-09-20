import { redirect, json, appOrigin } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || !code || !(await env.TEAMDECK_KV.get(`oauth:state:${state}`))) return new Response('Invalid or expired OAuth state', { status: 400 });
  await env.TEAMDECK_KV.delete(`oauth:state:${state}`);
  const body = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${appOrigin(request, env)}/api/auth/gmail/callback`, grant_type: 'authorization_code' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) return json({ error: 'Google did not return an access token', details: tokens.error_description || tokens.error }, 502);
  if (tokens.refresh_token) await env.TEAMDECK_KV.put('gmail:refresh_token', tokens.refresh_token);
  let profile = null;
  for (const endpoint of ['https://openidconnect.googleapis.com/v1/userinfo', 'https://www.googleapis.com/oauth2/v3/userinfo', 'https://www.googleapis.com/oauth2/v2/userinfo']) {
    const profileResponse = await fetch(endpoint, { headers: { authorization: `Bearer ${tokens.access_token}` } });
    if (profileResponse.ok) { profile = await profileResponse.json(); break; }
  }
  if (!profile && tokens.id_token) {
    try {
      const payload = tokens.id_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      profile = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    } catch (_) { /* profile remains unavailable */ }
  }
  if (profile?.email) await env.TEAMDECK_KV.put('gmail:profile', JSON.stringify({ email: profile.email, name: profile.name, picture: profile.picture }));
  return Response.redirect(`${appOrigin(request, env)}/login?gmail=connected`, 302);
}
