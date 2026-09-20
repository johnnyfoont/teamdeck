import { json } from '../../../_lib/auth.js';

export async function onRequestGet({ env }) {
  if (!env?.TEAMDECK_KV) return json({ events: [] });
  const listing = await env.TEAMDECK_KV.list({ prefix: 'security:event:', limit: 100 });
  const events = (await Promise.all((listing.keys || []).map(async ({ name }) => env.TEAMDECK_KV.get(name, 'json'))))
    .filter(Boolean)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return json({ events });
}
