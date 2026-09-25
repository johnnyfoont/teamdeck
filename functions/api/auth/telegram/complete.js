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
  const successPage = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teamdeck — проверка входа</title><style>body{margin:0;padding:32px;background:#07101f;color:#eef4ff;font:16px Arial,sans-serif}main{max-width:680px;margin:10vh auto;padding:28px;border:1px solid #31517e;border-radius:18px;background:#14243a}h1{font-size:24px}pre{padding:16px;border-radius:10px;background:#091526;color:#b9d2f5;white-space:pre-wrap}button{padding:11px 16px;border:0;border-radius:9px;background:#1769ff;color:white;font-weight:700}</style><main><h1>Проверяем сессию Teamdeck…</h1><p id="status">Cookie установлена. Проверяем, видит ли её demo.</p><pre id="details">Ожидание ответа…</pre><button id="retry" hidden>Повторить проверку</button></main><script>async function check(){try{const r=await fetch("/api/auth/session?debug=1",{credentials:"include",cache:"no-store"});const d=await r.json();document.getElementById("details").textContent=JSON.stringify({httpStatus:r.status,authenticated:d.authenticated,debug:d.debug,error:d.error},null,2);if(r.ok&&d.authenticated){document.getElementById("status").textContent="Сессия найдена. Открываем demo…";setTimeout(()=>location.replace("/dashboard"),500)}else{document.getElementById("status").textContent="Demo не видит сессию. Этот экран оставлен для диагностики.";document.getElementById("retry").hidden=false}}catch(e){document.getElementById("details").textContent=String(e);document.getElementById("retry").hidden=false}}document.getElementById("retry").onclick=check;check()</script>';
  if (wantsJson) return json({ authenticated: true, diagnostics: { handoffFoundInKv: true, sessionTokenPresent: true, sessionCookieSet: true, kvBindingPresent: true } }, 200, { 'set-cookie': value, 'cache-control': 'no-store' });
  return new Response(successPage, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': value } });
}
