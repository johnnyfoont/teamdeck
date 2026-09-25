import { redirect } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff') || '';
  if (!handoff) return redirect('https://login.teamdeck.space/');

  if (!env.TEAMDECK_KV) return redirect('https://login.teamdeck.space/?telegram=server');

  const key = `telegram:handoff:${handoff}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record?.session) return redirect('https://login.teamdeck.space/?telegram=expired');

  await env.TEAMDECK_KV.delete(key);

  // Set the session cookie on the demo host itself. This avoids relying on
  // cross-subdomain cookie handling in Safari while preserving the same
  // server-side KV session.
  const sessionCookie = `teamdeck_session=${encodeURIComponent(record.session)}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`;

  return new Response(null, {
    status: 302,
    headers: {
      location: 'https://demo.teamdeck.space/dashboard',
      'cache-control': 'no-store',
      'set-cookie': sessionCookie
    }
  });
}
