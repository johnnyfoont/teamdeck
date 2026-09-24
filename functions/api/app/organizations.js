import { getSessionUser, getSetupContext, id, body, json, unauthorized } from '../../_lib/app.js';

function clean(value) { return String(value || '').trim(); }

export async function onRequestGet({ request, env }) {
  const context = await getSetupContext(request, env);
  if (!context) return unauthorized();
  return json({ user: context.user, memberships: context.memberships });
}

export async function onRequestPost({ request, env }) {
  const auth = await getSessionUser(request, env);
  if (!auth) return unauthorized();
  const data = await body(request);
  const name = clean(data.name || data.legalName);
  const inn = clean(data.inn);
  const billingEmail = clean(data.billingEmail || auth.email).toLowerCase();
  if (!name || !inn || !billingEmail) return json({ error: 'Название, ИНН и e-mail обязательны' }, 400);
  if (!/^\d{10}(\d{2})?$/.test(inn)) return json({ error: 'ИНН должен содержать 10 цифр для организации или 12 цифр для ИП' }, 400);
  const existing = await env.TEAMDECK_DB.prepare('SELECT id FROM organizations WHERE inn=?').bind(inn).first();
  if (existing) return json({ error: 'Организация с таким ИНН уже зарегистрирована', code: 'ORG_EXISTS' }, 409);
  const organizationId = id();
  const slug = `org-${organizationId.slice(0, 8)}`;
  try {
    await env.TEAMDECK_DB.batch([
      env.TEAMDECK_DB.prepare('INSERT INTO organizations (id,name,slug,legal_name,inn,kpp,legal_address,billing_email,status,company_source) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(organizationId, name, slug, clean(data.legalName) || name, inn, clean(data.kpp) || null, clean(data.legalAddress) || null, billingEmail, 'draft', clean(data.companySource) || 'manual'),
      env.TEAMDECK_DB.prepare(`INSERT INTO memberships (id,organization_id,user_id,role,status) VALUES (?,?,?,?, 'active')`).bind(id(), organizationId, auth.userId, 'owner')
    ]);
  } catch (error) {
    return json({ error: 'Не удалось создать организацию', detail: String(error?.message || error) }, 500);
  }
  return json({ id: organizationId, name, inn, status: 'draft', next: 'billing' }, 201);
}
