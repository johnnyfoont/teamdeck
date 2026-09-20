const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

export function redirect(url, status = 302) {
  return new Response(null, { status, headers: { location: url, 'cache-control': 'no-store' } });
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function randomCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, '0');
}

export function randomToken() {
  return crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function recordSecurityEvent(env, request, event) {
  if (!env?.TEAMDECK_KV) return null;
  const now = new Date();
  const id = crypto.randomUUID();
  const userAgent = request.headers.get('user-agent') || 'Неизвестное устройство';
  const country = request.headers.get('cf-ipcountry') || 'Неизвестный регион';
  const record = {
    id,
    type: event.type || 'login',
    title: event.title || 'Вход выполнен',
    user: event.user || 'Неизвестный пользователь',
    identity: event.identity || event.user || '',
    method: event.method || 'Неизвестный способ',
    time: now.toISOString(),
    meta: `${event.device || userAgent} · ${country}`,
    device: event.device || userAgent,
    location: country,
    lastSeen: now.toISOString(),
    status: 'active'
  };
  await env.TEAMDECK_KV.put(`security:event:${now.getTime()}:${id}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 365 });
  return record;
}

export async function getGmailAccessToken(env) {
  const refreshToken = await env.TEAMDECK_KV.get('gmail:refresh_token');
  if (!refreshToken) throw new Error('Gmail is not connected yet');
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('Unable to refresh Gmail access token');
  return data.access_token;
}

export function appOrigin(request, env) {
  return env.APP_ORIGIN || new URL(request.url).origin;
}
