import { redirect, appOrigin, randomToken } from '../../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.YANDEX_CLIENT_ID || !env.YANDEX_CLIENT_SECRET) return new Response('Yandex OAuth is not configured', { status: 503 });
  const state = randomToken();
  await env.TEAMDECK_KV.put(`oauth:yandex:state:${state}`, '1', { expirationTtl: 600 });
  const redirectUri = `${appOrigin(request, env)}/api/auth/yandex/callback`;
  const url = new URL('https://oauth.yandex.ru/authorize');
  url.search = new URLSearchParams({ response_type: 'code', client_id: env.YANDEX_CLIENT_ID, redirect_uri: redirectUri, state }).toString();
  return redirect(url.toString());
}
EOF

