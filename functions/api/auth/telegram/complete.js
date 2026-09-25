import { redirect, cookie } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const handoff = url.searchParams.get('handoff') || '';
  if (!handoff) return redirect('https://login.teamdeck.space/');

  const key = `telegram:handoff:${handoff}`;
  const record = await env.TEAMDECK_KV.get(key, 'json');
  if (!record?.session) return redirect('https://login.teamdeck.space/?telegram=expired');

  await env.TEAMDECK_KV.delete(key);

  return new Response(null, {
    status: 302,
    headers: {
      location: 'https://demo.teamdeck.space/dashboard',
      'cache-control': 'no-store',
      'set-cookie': cookie('teamdeck_session', record.session, 60 * 60 * 24 * 30, request)
    }
  });
}
