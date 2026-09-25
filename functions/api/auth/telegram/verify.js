import { json, normalizeEmail, recordSecurityEvent, isSecurityBlocked, randomToken, cookie } from '../../../_lib/auth.js';

const encoder = new TextEncoder();

function hex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join(''); }

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign({ name: 'HMAC' }, cryptoKey, encoder.encode(value));
}

async function sha256(value) { return crypto.subtle.digest('SHA-256', encoder.encode(value)); }

export async function onRequestPost({ request, env }) {
  let stage = 'получение данных Telegram';
  try {
    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }

    const hash = String(payload.hash || '');
    const authDate = Number(payload.auth_date || 0);

    if (!env.TELEGRAM_BOT_TOKEN) return json({ error: 'Telegram авторизация не настроена: отсутствует Bot Token.' }, 503);
    if (!env.TEAMDECK_KV) return json({ error: 'Сервер авторизации не настроен: отсутствует KV.' }, 503);
    if (!hash || !authDate) return json({ error: 'Telegram не передал данные авторизации. Запустите вход ещё раз.' }, 400);

    const driftSeconds = Math.abs(Date.now() / 1000 - authDate);
    if (driftSeconds > 600) return json({ error: 'Истёк срок действия данных Telegram. Запустите вход ещё раз.' }, 401);

    stage = 'проверка подписи Telegram: подготовка строки';
    const checkString = Object.keys(payload)
      .filter(key => key !== 'hash' && payload[key] !== undefined && payload[key] !== null)
      .sort()
      .map(key => key + '=' + String(payload[key]))
      .join('\n');

    stage = 'проверка подписи Telegram: SHA-256 Bot Token';
    const secretKey = new Uint8Array(await sha256(env.TELEGRAM_BOT_TOKEN));

    stage = 'проверка подписи Telegram: HMAC-SHA-256';
    const signatureBuffer = await hmac(secretKey, checkString);

    stage = 'проверка подписи Telegram: сравнение';
    const expected = hex(signatureBuffer);
    if (expected !== hash) {
      return json({
        error: 'Invalid Telegram login signature',
        detail: 'Подпись Telegram не совпала. Проверьте настройки Telegram Login Widget и Bot Token.'
      }, 401);
    }

    stage = 'проверка блокировки';
    const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || (payload.username ? `@${payload.username}` : `Telegram ${payload.id}`);
    const profile = {
      id: String(payload.id),
      name,
      email: normalizeEmail(payload.username ? `${payload.username}@telegram.local` : `telegram-${payload.id}@telegram.local`),
      picture: payload.photo_url || '',
      username: payload.username || '',
      provider: 'telegram'
    };
    if (await isSecurityBlocked(env, profile.email)) return json({ error: 'Этот идентификатор заблокирован администратором' }, 403);

    stage = 'запись события безопасности';
    await recordSecurityEvent(env, request, { user: name, identity: profile.email, method: 'Telegram' });

    stage = 'создание сессии';
    const session = randomToken();
    await env.TEAMDECK_KV.put(`session:${session}`, JSON.stringify({ email: profile.email, name, createdAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });

    stage = 'создание handoff';
    const handoff = randomToken();
    await env.TEAMDECK_KV.put(`telegram:handoff:${handoff}`, JSON.stringify({ session }), { expirationTtl: 60 });

    stage = 'формирование ответа';
    // Send the browser to the demo application's normal entry point with the handoff in the query string.
    const redirectUrl = `https://demo.teamdeck.space/?telegram_handoff=${encodeURIComponent(handoff)}`;
    return json({ profile, handoff, redirectUrl }, 200, {
      'set-cookie': cookie('teamdeck_session', session, 60 * 60 * 24 * 30, request)
    });
  } catch (error) {
    console.error('Telegram auth failed at stage:', stage, error);
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'UnknownError';
    return json({
      error: 'Ошибка сервера авторизации',
      detail: `Сбой на этапе: ${stage} — ${name}: ${message}`
    }, 500);
  }
}
