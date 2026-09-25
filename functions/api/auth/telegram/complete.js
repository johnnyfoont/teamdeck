import { json, redirect } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff') || '';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (!handoff) {
    if (wantsJson) return json({ authenticated: false, error: 'telegram_handoff_missing', detail: 'Telegram handoff отсутствует в адресе перехода.' }, 400);
    return redirect('https://login.teamdeck.space/');
  }

  if (!env.TEAMDECK_KV) {
    if (wantsJson) return json({ authenticated: false, error: 'telegram_kv_missing', detail: 'На demo.teamdeck.space не найден KV binding TEAMDECK_KV.' }, 503);
    return redirect('https://login.teamdeck.space/?telegram=server');
  }

  const key = `telegram:handoff:${handoff}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record?.session) {
    if (wantsJson) return json({ authenticated: false, error: 'telegram_handoff_not_found', detail: 'Telegram handoff не найден в KV demo.teamdeck.space. Возможно, login и demo используют разные KV binding.' }, 404);
    return redirect('https://login.teamdeck.space/?telegram=expired');
  }

  await env.TEAMDECK_KV.delete(key);

  const sessionCookie = `teamdeck_session=${encodeURIComponent(record.session)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if (wantsJson) {
    return json({ authenticated: true, diagnostics: { handoffFoundInKv: true, sessionTokenPresent: Boolean(record.session), sessionCookieSet: true, kvBindingPresent: true } }, 200, {
      'set-cookie': sessionCookie,
      'cache-control': 'no-store'
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: 'https://demo.teamdeck.space/dashboard',
      'cache-control': 'no-store',
      'set-cookie': sessionCookie
    }
  });
}
