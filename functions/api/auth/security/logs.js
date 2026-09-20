import { json, sha256 } from '../../../_lib/auth.js';

export async function onRequestGet({ env }) {
  if (!env?.TEAMDECK_KV) return json({ events: [] });
  const listing = await env.TEAMDECK_KV.list({ prefix: 'security:event:', limit: 100 });
  const blockedListing = await env.TEAMDECK_KV.list({ prefix: 'security:blocked:', limit: 100 });
  const events = (await Promise.all((listing.keys || []).map(async ({ name }) => env.TEAMDECK_KV.get(name, 'json'))))
    .filter(Boolean)
    .sort((a, b) => String(b.time).localeCompare(String(a.time)));
  await Promise.all(events.map(async event => {
    if (!event.identity) return;
    const key = await sha256(event.identity);
    const [blocked, revoked] = await Promise.all([env.TEAMDECK_KV.get(`security:blocked:${key}`), env.TEAMDECK_KV.get(`security:revoked:${key}`)]);
    event.status = blocked ? 'blocked' : revoked ? 'revoked' : 'active';
  }));
  const blocked = (await Promise.all((blockedListing.keys || []).map(async ({ name }) => env.TEAMDECK_KV.get(name, 'json')))).filter(Boolean);
  return json({ events, blocked });
}
