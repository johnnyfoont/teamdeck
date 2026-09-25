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
  if (!env.TELEGRAM_BOT_TOKEN || !env.TEAMDECK_KV) return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=callback&reason=not-configured');
  if (!hash || !authDate || Math.abs(Date.now() / 1000 - authDate) > 600) return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=callback&reason=expired');

  const checkString = Object.keys(payload).filter(key => key !== 'hash' && payload[key] !== undefined && payload[key] !== null).sort().map(key => `${key}=${payload[key]}`).join('\n');
  const expected = hex(await hmac(new Uint8Array(await sha256(env.TELEGRAM_BOT_TOKEN)), checkString));
  if (expected !== hash) return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=callback&reason=invalid');

  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || (payload.username ? `@${payload.username}` : `Telegram ${payload.id}`);
  const profile = { id: String(payload.id), name, email: normalizeEmail(payload.username ? `${payload.username}@telegram.local` : `telegram-${payload.id}@telegram.local`), picture: payload.photo_url || '', username: payload.username || '', provider: 'telegram' };
  if (await isSecurityBlocked(env, profile.email)) return redirect(`https://demo.teamdeck.space/?auth_debug=1&stage=callback&reason=blocked`);
  await recordSecurityEvent(env, request, { user: name, identity: profile.email, method: 'Telegram' });
  const session = randomToken();
  await env.TEAMDECK_KV.put(`session:${session}`, JSON.stringify({ email: profile.email, name, createdAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  // Do not rely on Safari accepting a Domain=.teamdeck.space cookie from the
  // Telegram popup. Let demo set its own host-only cookie after consuming handoff.
  const handoff = randomToken();
  await env.TEAMDECK_KV.put(`telegram:handoff:${handoff}`, JSON.stringify({ session }), { expirationTtl: 60 });
  return new Response(null, { status: 302, headers: { location: `https://demo.teamdeck.space/api/auth/telegram/complete?handoff=${encodeURIComponent(handoff)}`, 'cache-control': 'no-store' } });
}
