import { redirect, json, appOrigin, normalizeEmail, sha256, recordSecurityEvent } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const stateKey = state ? `oauth:yandex:state:${state}` : '';
  if (!state || !code || !(await env.TEAMDECK_KV.get(stateKey))) return new Response('Invalid or expired Yandex OAuth state', { status: 400 });
  await env.TEAMDECK_KV.delete(stateKey);
  const redirectUri = `${appOrigin(request, env)}/api/auth/yandex/callback`;
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env.YANDEX_CLIENT_ID, client_secret: env.YANDEX_CLIENT_SECRET, redirect_uri: redirectUri });
  const tokenResponse = await fetch('https://oauth.yandex.ru/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) return json({ error: 'Yandex did not return an access token' }, 502);
  const profileResponse = await fetch('https://login.yandex.ru/info?format=json', { headers: { authorization: `OAuth ${tokens.access_token}` } });
  const profile = profileResponse.ok ? await profileResponse.json() : {};
  const email = normalizeEmail(profile.default_email || profile.emails?.[0] || profile.email);
  if (!email) return new Response('Yandex did not return an email address', { status: 502 });
  const userProfile = { email, name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || email, picture: profile.default_avatar_id ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200` : '', provider: 'yandex' };
  const handoff = crypto.randomUUID();
  await env.TEAMDECK_KV.put(`oauth:yandex:session:${handoff}`, JSON.stringify(userProfile), { expirationTtl: 120 });
  await env.TEAMDECK_KV.put(`external:profile:${await sha256(email)}`, JSON.stringify(userProfile));
  await recordSecurityEvent(env, request, { user: userProfile.name, identity: email, method: 'Яндекс' });
  return redirect(`${appOrigin(request, env)}/login?external=yandex&state=${encodeURIComponent(handoff)}`);
}
