import { getAppContext, id, token, sha256, body, json, unauthorized, forbidden, writer, sendEmail } from '../../_lib/app.js';

function clean(value) { return String(value || '').trim(); }
function validRole(value) { return ['admin', 'hr', 'manager', 'member'].includes(value) ? value : 'member'; }

export async function onRequestGet({ request, env }) {
  const context = await getAppContext(request, env);
  if (!context) return unauthorized('Нет активного доступа к организации');
  if (!writer(context)) return forbidden();
  const rows = await env.TEAMDECK_DB.prepare('SELECT id,email,first_name,last_name,job_title,department_id,role,status,expires_at,accepted_at,created_at FROM invitations WHERE organization_id=? ORDER BY created_at DESC').bind(context.organization.id).all();
  return json({ invitations: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const context = await getAppContext(request, env);
  if (!context) return unauthorized('Нет активного доступа к организации');
  if (!writer(context)) return forbidden();
  const data = await body(request);
  const email = clean(data.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Укажите корректный корпоративный e-mail' }, 400);
  const rawToken = token();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const invitationId = id();
  await env.TEAMDECK_DB.prepare('INSERT INTO invitations (id,organization_id,email,first_name,last_name,job_title,department_id,role,token_hash,status,expires_at,invited_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(invitationId, context.organization.id, email, clean(data.firstName) || null, clean(data.lastName) || null, clean(data.jobTitle) || null, data.departmentId || null, validRole(data.role), await sha256(rawToken), 'pending', expiresAt, context.user.id).run();
  const inviteUrl = `https://login.teamdeck.space/?invite=${encodeURIComponent(rawToken)}`;
  let emailSent = false;
  try {
    await sendEmail(env, { to: email, subject: `Приглашение в Teamdeck — ${context.organization.name}`, text: `Вас пригласили в рабочее пространство ${context.organization.name} в Teamdeck.\n\nОткройте ссылку, чтобы принять приглашение:\n${inviteUrl}\n\nСсылка действует 7 дней.` });
    emailSent = true;
  } catch (_) { /* Keep invitation pending; Gmail can be connected before production email rollout. */ }
  return json({ invitationId, status: 'pending', expiresAt, emailSent }, 201);
}
