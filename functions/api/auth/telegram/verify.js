import { json, normalizeEmail } from '../../../_lib/auth.js';

const encoder = new TextEncoder();

function hex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join(''); }

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

async function sha256(value) { return crypto.subtle.digest('SHA-256', encoder.encode(value)); }

export async function onRequestPost({ request, env }) {
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const hash = String(payload.hash || '');
  const authDate = Number(payload.auth_date || 0);
  if (!hash || !env.TELEGRAM_BOT_TOKEN || !authDate || Math.abs(Date.now() / 1000 - authDate) > 600) return json({ error: 'Telegram login data expired' }, 401);
  const checkString = Object.keys(payload).filter(key => key !== 'hash' && payload[key] !== undefined && payload[key] !== null).sort().map(key => `${key}=${payload[key]}`).join('\n');
  const secretKey = await sha256(env.TELEGRAM_BOT_TOKEN);
  const expected = hex(await hmac(secretKey, checkString));
  if (expected !== hash) return json({ error: 'Invalid Telegram login signature' }, 401);
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || (payload.username ? `@${payload.username}` : `Telegram ${payload.id}`);
  return json({ profile: { id: String(payload.id), name, email: normalizeEmail(payload.username ? `${payload.username}@telegram.local` : `telegram-${payload.id}@telegram.local`), picture: payload.photo_url || '', username: payload.username || '', provider: 'telegram' } });
}
