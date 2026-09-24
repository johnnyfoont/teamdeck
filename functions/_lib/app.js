import { sha256, json, getGmailAccessToken } from './auth.js';

function cookie(request, name) {
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

export async function getSessionUser(request, env) {
  if (!env.TEAMDECK_DB || !env.TEAMDECK_KV) return null;
  const token = cookie(request, 'teamdeck_session');
  const session = token ? await env.TEAMDECK_KV.get(`session:${token}`, 'json') : null;
  if (!session?.email) return null;
  const email = String(session.email).trim().toLowerCase();
  const userId = await sha256(`teamdeck:user:${email}`);
  await env.TEAMDECK_DB.prepare(`INSERT INTO users (id,email,display_name) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`).bind(userId, email, session.name || email).run();
  const user = await env.TEAMDECK_DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
  return { token, session, user, userId, email };
}

export async function getAppContext(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return null;
  const organization = await env.TEAMDECK_DB.prepare(`SELECT o.* FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=? AND m.status='active' AND o.status IN ('active','trial') ORDER BY o.created_at LIMIT 1`).bind(auth.userId).first();
  if (!organization) return null;
  const membership = await env.TEAMDECK_DB.prepare(`SELECT * FROM memberships WHERE organization_id=? AND user_id=? AND status='active'`).bind(organization.id, auth.userId).first();
  return membership ? { ...auth, user: auth.user, organization, membership } : null;
}

export async function getSetupContext(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth) return null;
  const memberships = await env.TEAMDECK_DB.prepare(`SELECT m.*, o.name, o.legal_name, o.inn, o.status AS organization_status FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? ORDER BY o.created_at`).bind(auth.userId).all();
  return { ...auth, memberships: memberships.results || [] };
}

export function unauthorized(message = 'Требуется авторизация') { return json({ error: message, code: 'AUTH_REQUIRED' }, 401); }
export function accessRequired() { return json({ error: 'Рабочий доступ к организации ещё не предоставлен', code: 'APP_ACCESS_REQUIRED' }, 403); }
export function forbidden() { return json({ error: 'Недостаточно прав' }, 403); }
export function writer(context) { return ['owner', 'admin', 'hr'].includes(context?.membership?.role); }
export function orgId(context) { return context.organization.id; }
export function body(request) { return request.json().catch(() => ({})); }
export function id() { return crypto.randomUUID(); }
export function token() { return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', ''); }

function base64url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sendEmail(env, { to, subject, text }) {
  const accessToken = await getGmailAccessToken(env);
  const from = env.OTP_SENDER_EMAIL || 'teamdeck.ru@gmail.com';
  const raw = [`From: Teamdeck <${from}>`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', '', text].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw: base64url(raw) }) });
  if (!response.ok) throw new Error('Gmail send failed');
  return true;
}

export async function bootstrap(env, context) {
  const organizationId = orgId(context);
  const [departments, employees, audit] = await Promise.all([
    env.TEAMDECK_DB.prepare('SELECT * FROM departments WHERE organization_id=? ORDER BY name').bind(organizationId).all(),
    env.TEAMDECK_DB.prepare('SELECT e.*, d.name AS department_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.organization_id=? ORDER BY e.last_name,e.first_name').bind(organizationId).all(),
    env.TEAMDECK_DB.prepare('SELECT * FROM audit_events WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').bind(organizationId).all()
  ]);
  return { organization: context.organization, user: context.user, membership: context.membership, departments: departments.results || [], employees: employees.results || [], audit: audit.results || [] };
}

export async function audit(env, context, action, entityType, entityId, payload = {}) {
  await env.TEAMDECK_DB.prepare('INSERT INTO audit_events (id,organization_id,actor_user_id,action,entity_type,entity_id,payload_json) VALUES (?,?,?,?,?,?,?)').bind(id(), orgId(context), context.user.id, action, entityType, entityId || null, JSON.stringify(payload)).run();
}

export async function seedDepartments(env, context) {
  const row = await env.TEAMDECK_DB.prepare('SELECT COUNT(*) AS count FROM departments WHERE organization_id=?').bind(orgId(context)).first();
  if (Number(row?.count)) return;
  for (const name of ['HR', 'Разработка', 'Продажи']) {
    await env.TEAMDECK_DB.prepare('INSERT INTO departments (id,organization_id,name) VALUES (?,?,?)').bind(id(), orgId(context), name).run();
  }
}

export { cookie as readCookie };
export { json };
export { sha256 };
