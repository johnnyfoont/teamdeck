import { getSetupContext, unauthorized, json } from '../../_lib/app.js';

export async function onRequestGet({ request, env }) {
  const context = await getSetupContext(request, env);
  if (!context) return unauthorized();
  const rows = await env.TEAMDECK_DB.prepare('SELECT * FROM plans WHERE active=1 ORDER BY price_minor').all();
  return json({ plans: rows.results || [] });
}
