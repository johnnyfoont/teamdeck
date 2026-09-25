import { redirect, normalizeEmail, recordSecurityEvent, isSecurityBlocked, randomToken, cookie } from '../../../_lib/auth.js';

const encoder = new TextEncoder();
function hex(bytes) { return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function sha256(value) { return crypto.subtle.digest('SHA-256', encoder.encode(value)); }
async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign({ name: 'HMAC' }, cryptoKey, encoder.encode(value));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const payload = Object.fromEntries(url.searchParams.entries());
  const hash = String(payload.hash || '');
  const authDate = Number(payload.auth_date || 0);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TEAMDECK_KV) return redirect('https://login.teamdeck.space/?telegram=not-configured');
  if (!hash || !authDate || Math.abs(Date.now() / 1000 - authDate) > 600) return redirect('https://login.teamdeck.space/?telegram=expired');

  const checkString = Object.keys(payload).filter(key => key !== 'hash' && payload[key] !== undefined && payload[key] !== null).sort().map(key => `${key}=${payload[key]}`).join('\n');
  const expected = hex(await hmac(new Uint8Array(await sha256(env.TELEGRAM_BOT_TOKEN)), checkString));
  if (expected !== hash) return redirect('https://login.teamdeck.space/?telegram=invalid');

  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || (payload.username ? `@${payload.username}` : `Telegram ${payload.id}`);
  const profile = { id: String(payload.id), name, email: normalizeEmail(payload.username ? `${payload.username}@telegram.local` : `telegram-${payload.id}@telegram.local`), picture: payload.photo_url || '', username: payload.username || '', provider: 'telegram' };
  if (await isSecurityBlocked(env, profile.email)) return redirect(`https://login.teamdeck.space/?blocked=1&identity=${encodeURIComponent(profile.email)}`);
  await recordSecurityEvent(env, request, { user: name, identity: profile.email, method: 'Telegram' });
  const session = randomToken();
  await env.TEAMDECK_KV.put(`session:${session}`, JSON.stringify({ email: profile.email, name, createdAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return new Response(null, { status: 302, headers: { location: 'https://demo.teamdeck.space/dashboard', 'cache-control': 'no-store', 'set-cookie': cookie('teamdeck_session', session, 60 * 60 * 24 * 30, request) } });
}
