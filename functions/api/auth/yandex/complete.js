import { redirect, json, cookie, randomToken } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff');
  const wantsJson = url.searchParams.get('format') === 'json';
  if (!handoff) return wantsJson ? json({ authenticated: false, error: 'missing_handoff' }, 400) : redirect('https://login.teamdeck.space/');

  const key = `oauth:yandex:session:${handoff}`;
  const profile = await env.TEAMDECK_KV.get(key, 'json');
  if (!profile?.email) return wantsJson ? json({ authenticated: false, error: 'handoff_expired' }, 404) : redirect('https://login.teamdeck.space/?error=yandex_handoff_expired');
  await env.TEAMDECK_KV.delete(key);

  const session = randomToken();
  await env.TEAMDECK_KV.put(`session:${session}`, JSON.stringify({ email: profile.email, name: profile.name || profile.email, createdAt: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  const sessionCookie = cookie('teamdeck_session', session, 60 * 60 * 24 * 30, request);
  if (wantsJson) return json({ authenticated: true, profile }, 200, { 'set-cookie': sessionCookie });

  const successPage = '<!doctype html><meta charset="utf-8"><title>Teamdeck</title><p>Выполняется вход…</p><script>setTimeout(()=>location.replace("/dashboard"),80)</script>';
  return new Response(successPage, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': sessionCookie } });
}
