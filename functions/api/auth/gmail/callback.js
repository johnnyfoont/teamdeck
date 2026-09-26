import { redirect, json, appOrigin, normalizeEmail, sha256 } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  let stage = 'oauth_state';
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || !code) return json({ error: 'Missing OAuth state or code' }, 400);

    const stateKey = `oauth:state:${state}`;
    const stateValue = await env.TEAMDECK_KV.get(stateKey);
    if (!stateValue) return json({ error: 'Invalid or expired OAuth state' }, 400);
    await env.TEAMDECK_KV.delete(stateKey);

    stage = 'google_token_exchange';
    const redirectUri = `${appOrigin(request, env)}/api/auth/gmail/callback`;
    const body = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const rawTokens = await response.text();
    let tokens = {};
    try { tokens = JSON.parse(rawTokens); } catch (_) {}
    if (!response.ok || !tokens.access_token) {
      return json({
        error: 'Google token exchange failed',
        stage,
        google_error: tokens.error || `http_${response.status}`,
        google_description: tokens.error_description || 'Google did not return an access token',
        redirect_uri: redirectUri,
      }, 502);
    }

    stage = 'save_refresh_token';
    if (tokens.refresh_token) await env.TEAMDECK_KV.put('gmail:refresh_token', tokens.refresh_token);

    stage = 'google_profile';
    let profile = null;
    for (const endpoint of [
      'https://openidconnect.googleapis.com/v1/userinfo',
      'https://www.googleapis.com/oauth2/v3/userinfo',
      'https://www.googleapis.com/oauth2/v2/userinfo',
    ]) {
      const profileResponse = await fetch(endpoint, { headers: { authorization: `Bearer ${tokens.access_token}` } });
      if (profileResponse.ok) { profile = await profileResponse.json(); break; }
    }
    if (!profile && tokens.id_token) {
      try {
        const payload = tokens.id_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
        profile = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
      } catch (_) {}
    }

    stage = 'save_profile';
    if (profile?.email) {
      const normalizedProfile = { email: normalizeEmail(profile.email), name: profile.name || '', picture: profile.picture || '' };
      await env.TEAMDECK_KV.put('gmail:profile', JSON.stringify(normalizedProfile));
      await env.TEAMDECK_KV.put(`gmail:profile:${await sha256(normalizedProfile.email)}`, JSON.stringify(normalizedProfile));
    }
    return Response.redirect(`${appOrigin(request, env)}/?gmail=connected`, 302);
  } catch (error) {
    return json({
      error: 'Gmail OAuth callback failed',
      stage,
      message: String(error?.message || error || 'Unknown server error'),
    }, 502);
  }
}
