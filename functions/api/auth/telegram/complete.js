import { json, redirect } from '../../../_lib/auth.js';

function sessionToken(request) {
  const header = request.headers.get('cookie') || '';
  const item = header.split(';').map(value => value.trim()).find(value => value.startsWith('teamdeck_session='));
  return item ? decodeURIComponent(item.slice('teamdeck_session='.length)) : '';
}

async function sessionProfile(request, env) {
  const token = sessionToken(request);
  if (!token || !env.TEAMDECK_KV) return null;
  const session = await env.TEAMDECK_KV.get(`session:${token}`, 'json');
  return session ? { token, session } : null;
}

function sessionCookie(token) {
  return `teamdeck_session=${encodeURIComponent(token)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff') || '';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (!env.TEAMDECK_KV) {
    if (wantsJson) return json({ authenticated: false, error: 'telegram_kv_missing', detail: 'На demo.teamdeck.space не найден KV binding TEAMDECK_KV.' }, 503);
    return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=complete&reason=server');
  }
  if (!handoff) {
    const existing = await sessionProfile(request, env);
    if (existing) {
      if (wantsJson) return json({ authenticated: true, profile: { name: existing.session.name || existing.session.email || 'Пользователь', email: existing.session.email || '' }, diagnostics: { fallback: 'server_session' } }, 200, { 'set-cookie': sessionCookie(existing.token) });
      return new Response(null, { status: 302, headers: { location: 'https://demo.teamdeck.space/dashboard', 'cache-control': 'no-store', 'set-cookie': sessionCookie(existing.token) } });
    }
    if (wantsJson) return json({ authenticated: false, error: 'telegram_handoff_missing', detail: 'Telegram handoff отсутствует, server-session также не найдена.' }, 400);
    return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=complete&reason=missing');
  }
  const key = `telegram:handoff:${handoff}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record?.session) {
    const existing = await sessionProfile(request, env);
    if (existing) {
      if (wantsJson) return json({ authenticated: true, profile: { name: existing.session.name || existing.session.email || 'Пользователь', email: existing.session.email || '' }, diagnostics: { fallback: 'server_session_after_handoff_miss' } }, 200, { 'set-cookie': sessionCookie(existing.token) });
      return new Response(null, { status: 302, headers: { location: 'https://demo.teamdeck.space/dashboard', 'cache-control': 'no-store', 'set-cookie': sessionCookie(existing.token) } });
    }
    if (wantsJson) return json({ authenticated: false, error: 'telegram_handoff_not_found', detail: 'Telegram handoff не найден и server-session недоступна.' }, 404);
    return redirect('https://demo.teamdeck.space/?auth_debug=1&stage=complete&reason=expired');
  }
  await env.TEAMDECK_KV.delete(key);
  const value = sessionCookie(record.session);
  const successPage = '<!doctype html><meta charset="utf-8"><title>Teamdeck</title><p>Выполняется вход…</p><script>location.replace("/dashboard")</script>';
  if (wantsJson) return json({ authenticated: true, diagnostics: { handoffFoundInKv: true, sessionTokenPresent: true, sessionCookieSet: true, kvBindingPresent: true } }, 200, { 'set-cookie': value, 'cache-control': 'no-store' });
  return new Response(successPage, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': value } });
}
