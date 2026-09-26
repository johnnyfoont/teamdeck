import { redirect, json, appOrigin, normalizeEmail, sha256, recordSecurityEvent, isSecurityBlocked } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const stateKey = state ? `oauth:mailru:state:${state}` : '';
  if (!state || !code || !(await env.TEAMDECK_KV.get(stateKey))) return new Response('Invalid or expired Mail.ru OAuth state', { status: 400 });
  await env.TEAMDECK_KV.delete(stateKey);

  const redirectUri = `${appOrigin(request, env)}/api/auth/mailru/callback`;
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env.MAILRU_CLIENT_ID, client_secret: env.MAILRU_CLIENT_SECRET, redirect_uri: redirectUri });
  const tokenResponse = await fetch('https://oauth.mail.ru/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const rawTokens = await tokenResponse.text();
  let tokens = {};
  try { tokens = JSON.parse(rawTokens); } catch (_) {}
  if (!tokenResponse.ok || !tokens.access_token) return json({ error: 'Mail.ru token exchange failed', details: tokens.error_description || tokens.error || `http_${tokenResponse.status}` }, 502);

  const profileResponse = await fetch('https://oauth.mail.ru/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = profileResponse.ok ? await profileResponse.json() : {};
  const email = normalizeEmail(profile.email || profile.email_address || profile.default_email);
  if (!email) return json({ error: 'Mail.ru did not return an email address' }, 502);
  if (await isSecurityBlocked(env, email)) return redirect(`${appOrigin(request, env)}/?blocked=1&identity=${encodeURIComponent(email)}`);

  const userProfile = {
    email,
    name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.nick || email,
    picture: profile.image || profile.photo || profile.avatar || '',
    provider: 'mailru',
  };
  const handoff = crypto.randomUUID();
  await env.TEAMDECK_KV.put(`oauth:mailru:session:${handoff}`, JSON.stringify(userProfile), { expirationTtl: 120 });
  await env.TEAMDECK_KV.put(`external:profile:${await sha256(email)}`, JSON.stringify(userProfile));
  await recordSecurityEvent(env, request, { user: userProfile.name, identity: email, method: 'Mail.ru' });
  return redirect(`https://demo.teamdeck.space/api/auth/mailru/complete?handoff=${encodeURIComponent(handoff)}`);
}
