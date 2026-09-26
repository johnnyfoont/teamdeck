import { redirect, json, appOrigin, normalizeEmail, sha256, recordSecurityEvent, isSecurityBlocked } from '../../../_lib/auth.js';

function parsePayload(raw) {
  try { return JSON.parse(raw); } catch (_) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

export async function onRequestGet({ request, env }) {
  let stage = 'oauth_state';
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const stateKey = state ? `oauth:mailru:state:${state}` : '';
    if (!state || !code || !(await env.TEAMDECK_KV.get(stateKey))) return new Response('Invalid or expired Mail.ru OAuth state', { status: 400 });
    await env.TEAMDECK_KV.delete(stateKey);

    stage = 'mailru_token_exchange';
    const redirectUri = `${appOrigin(request, env)}/api/auth/mailru/callback`;
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: env.MAILRU_CLIENT_ID || '', client_secret: env.MAILRU_CLIENT_SECRET || '', redirect_uri: redirectUri });
    const tokenResponse = await fetch('https://oauth.mail.ru/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    const rawTokens = await tokenResponse.text();
    const tokens = parsePayload(rawTokens);
    if (!tokenResponse.ok || !tokens.access_token) return json({ error: 'Mail.ru token exchange failed', stage, provider_error: tokens.error || `http_${tokenResponse.status}`, details: tokens.error_description || tokens.error || 'No access token returned' }, 502);

    stage = 'mailru_profile';
    let profileResponse = await fetch(`https://oauth.mail.ru/userinfo?access_token=${encodeURIComponent(tokens.access_token)}`, { headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' } });
    if (!profileResponse.ok) profileResponse = await fetch('https://oauth.mail.ru/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' } });
    const rawProfile = await profileResponse.text();
    const profile = parsePayload(rawProfile);
    if (!profileResponse.ok) return json({ error: 'Mail.ru profile request failed', stage, provider_error: profile.error || `http_${profileResponse.status}`, details: profile.error_description || 'Unable to load Mail.ru profile' }, 502);

    const email = normalizeEmail(profile.email || profile.email_address || profile.default_email || profile.mail);
    if (!email) return json({ error: 'Mail.ru did not return an email address', stage, profile_fields: Object.keys(profile).slice(0, 20) }, 502);
    if (await isSecurityBlocked(env, email)) return redirect(`${appOrigin(request, env)}/?blocked=1&identity=${encodeURIComponent(email)}`);

    stage = 'mailru_handoff';
    const userProfile = { email, name: profile.name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.nick || email, picture: profile.image || profile.photo || profile.avatar || '', provider: 'mailru' };
    const handoff = crypto.randomUUID();
    await env.TEAMDECK_KV.put(`oauth:mailru:session:${handoff}`, JSON.stringify(userProfile), { expirationTtl: 120 });
    await env.TEAMDECK_KV.put(`external:profile:${await sha256(email)}`, JSON.stringify(userProfile));
    await recordSecurityEvent(env, request, { user: userProfile.name, identity: email, method: 'Mail.ru' });
    return redirect(`https://demo.teamdeck.space/api/auth/mailru/complete?handoff=${encodeURIComponent(handoff)}`);
  } catch (error) {
    return json({ error: 'Mail.ru OAuth callback failed', stage, message: String(error?.message || error || 'Unknown server error') }, 502);
  }
}
