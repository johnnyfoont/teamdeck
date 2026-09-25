import { json, redirect } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff') || '';
  if (!handoff) return redirect('https://login.teamdeck.space/');

  if (!env.TEAMDECK_KV) return redirect('https://login.teamdeck.space/?telegram=server');

  const key = `telegram:handoff:${handoff}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record?.session) return redirect('https://login.teamdeck.space/?telegram=expired');

  await env.TEAMDECK_KV.delete(key);

  const sessionCookie = `teamdeck_session=${encodeURIComponent(record.session)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  if (wantsJson) {
    return json({ authenticated: true }, 200, {
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
