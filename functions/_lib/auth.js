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

export function cookie(name, value, maxAge, request) {
  const host = request ? new URL(request.url).hostname : '';
  const domain = /(^|\.)teamdeck\.space$/i.test(host) ? '; Domain=.teamdeck.space' : '';
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax${domain}`;
}

export function clearCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

const countryNames = { RU: 'Россия', BY: 'Беларусь', KZ: 'Казахстан', AM: 'Армения', AZ: 'Азербайджан', KG: 'Кыргызстан', MD: 'Молдова', TJ: 'Таджикистан', TM: 'Туркменистан', UZ: 'Узбекистан', UA: 'Украина', DE: 'Германия', FR: 'Франция', GB: 'Великобритания', IT: 'Италия', ES: 'Испания', PL: 'Польша', NL: 'Нидерланды', US: 'США', CA: 'Канада', MX: 'Мексика', BR: 'Бразилия', AR: 'Аргентина', CN: 'Китай', JP: 'Япония', KR: 'Южная Корея', IN: 'Индия', TR: 'Турция', IL: 'Израиль', AE: 'ОАЭ', AU: 'Австралия', NZ: 'Новая Зеландия' };
const cisCodes = new Set(['RU', 'BY', 'KZ', 'AM', 'AZ', 'KG', 'MD', 'TJ', 'TM', 'UZ', 'UA']);
const europeCodes = new Set(['DE', 'FR', 'GB', 'IT', 'ES', 'PL', 'NL', 'BE', 'AT', 'CH', 'CZ', 'SE', 'NO', 'FI', 'DK', 'PT', 'GR', 'RO', 'BG', 'HU', 'IE', 'IS', 'EE', 'LV', 'LT', 'HR', 'RS', 'SI', 'SK']);
const asiaCodes = new Set(['CN', 'JP', 'KR', 'IN', 'TR', 'IL', 'AE', 'SA', 'TH', 'VN', 'SG', 'ID', 'MY', 'PH', 'PK', 'BD', 'IR', 'IQ', 'GE', 'MN']);
const americaCodes = new Set(['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC', 'BO', 'CR', 'PA']);
const oceaniaCodes = new Set(['AU', 'NZ', 'FJ', 'PG']);
function countryInfo(value) {
  const code = String(value || '').toUpperCase().slice(0, 2);
  const name = countryNames[code] || (code ? code : 'Неизвестная страна');
  const flag = /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0))) : '🌐';
  const region = cisCodes.has(code) ? 'Россия и СНГ' : europeCodes.has(code) ? 'Европа' : asiaCodes.has(code) ? 'Азия' : americaCodes.has(code) ? 'Америка' : oceaniaCodes.has(code) ? 'Океания' : 'Неизвестный регион';
  return { code, name, flag, region, label: `${flag} ${name}` };
}

function deviceCategory(value) {
  const text = String(value || '').toLowerCase();
  if (/^(планшет|tablet)$/i.test(text)) return 'Планшет';
  if (/^(смартфон|smartphone|mobile|phone)$/i.test(text)) return 'Смартфон';
  if (/^(десктоп|desktop)$/i.test(text)) return 'Десктоп';
  if (/ipad|tablet|android(?!.*mobile)/i.test(text)) return 'Планшет';
  if (/iphone|android.*mobile|mobile|phone/i.test(text)) return 'Смартфон';
  return 'Десктоп';
}

export async function recordSecurityEvent(env, request, event) {
  if (!env?.TEAMDECK_KV) return null;
  const now = new Date();
  const id = crypto.randomUUID();
  const userAgent = request.headers.get('user-agent') || 'Неизвестное устройство';
  const reportedDevice = request.headers.get('x-teamdeck-device');
  const device = event.device || deviceCategory(reportedDevice || userAgent);
  const country = countryInfo(request.headers.get('cf-ipcountry'));
  const record = {
    id,
    type: event.type || 'login',
    title: event.title || 'Вход выполнен',
    user: event.user || 'Неизвестный пользователь',
    identity: event.identity || event.user || '',
    method: event.method || 'Неизвестный способ',
    time: now.toISOString(),
    meta: `${device} · ${country.label}`,
    device,
    userAgent,
    location: country.label,
    country: country.name,
    countryFlag: country.flag,
    region: country.region,
    lastSeen: now.toISOString(),
    status: 'active'
  };
  await env.TEAMDECK_KV.put(`security:event:${now.getTime()}:${id}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 365 });
  return record;
}

export async function isSecurityBlocked(env, identity) {
  if (!env?.TEAMDECK_KV || !identity) return false;
  return Boolean(await env.TEAMDECK_KV.get(`security:blocked:${await sha256(identity)}`));
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
  const origin = new URL(request.url).origin;
  const hostname = new URL(request.url).hostname;
  if (hostname === 'app.teamdeck.space') return 'https://app.teamdeck.space';
  if (/(^|\.)teamdeck\.space$/i.test(hostname)) return 'https://login.teamdeck.space';
  return env.APP_ORIGIN || origin;
}
