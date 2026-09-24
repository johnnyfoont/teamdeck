import { sha256, json } from './auth.js';

function cookie(request, name) {
  const value = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}

export async function getAppContext(request, env) {
  if (!env.TEAMDECK_DB || !env.TEAMDECK_KV) return null;
  const token = cookie(request, 'teamdeck_session');
  const session = token ? await env.TEAMDECK_KV.get(`session:${token}`, 'json') : null;
  if (!session?.email) return null;
  const email = String(session.email).trim().toLowerCase();
  const userId = await sha256(`teamdeck:user:${email}`);
  await env.TEAMDECK_DB.prepare(`INSERT INTO users (id,email,display_name) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`).bind(userId, email, email).run();
  const user = await env.TEAMDECK_DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first();
  let organization = await env.TEAMDECK_DB.prepare(`SELECT o.* FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=? AND m.status='active' ORDER BY o.created_at LIMIT 1`).bind(userId).first();
  if (!organization) {
    const organizationId = crypto.randomUUID();
    await env.TEAMDECK_DB.batch([
      env.TEAMDECK_DB.prepare('INSERT INTO organizations (id,name,slug) VALUES (?,?,?)').bind(organizationId, 'Моя компания', `org-${userId.slice(0, 12)}`),
      env.TEAMDECK_DB.prepare(`INSERT INTO memberships (id,organization_id,user_id,role,status) VALUES (?,?,?,?, 'active')`).bind(crypto.randomUUID(), organizationId, userId, 'owner')
    ]);
    organization = await env.TEAMDECK_DB.prepare('SELECT * FROM organizations WHERE id=?').bind(organizationId).first();
  }
  const membership = await env.TEAMDECK_DB.prepare('SELECT * FROM memberships WHERE organization_id=? AND user_id=?').bind(organization.id, userId).first();
  return { user, organization, membership };
}

export function unauthorized() { return json({ error: 'Требуется авторизация' }, 401); }
export function forbidden() { return json({ error: 'Недостаточно прав' }, 403); }
export function writer(context) { return ['owner', 'admin', 'hr'].includes(context?.membership?.role); }
export function orgId(context) { return context.organization.id; }
export function body(request) { return request.json().catch(() => ({})); }
export function id() { return crypto.randomUUID(); }

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
