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
  const billingEmail = clean(data.billingEmail).toLowerCase() || null;
  if (!name || !inn) return json({ error: 'Название и ИНН обязательны' }, 400);
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

export async function onRequestPatch({ request, env }) {
  const auth = await getSessionUser(request, env);
  if (!auth) return unauthorized();
  const data = await body(request);
  const organization = await env.TEAMDECK_DB.prepare('SELECT * FROM organizations WHERE id=?').bind(data.organizationId).first();
  const membership = organization ? await env.TEAMDECK_DB.prepare('SELECT * FROM memberships WHERE organization_id=? AND user_id=? AND role IN (\'owner\',\'admin\')').bind(organization.id, auth.userId).first() : null;
  if (!organization || !membership) return json({ error: 'Организация не найдена' }, 404);
  const billingEmail = clean(data.billingEmail || organization.billing_email).toLowerCase();
  const plan = await env.TEAMDECK_DB.prepare('SELECT * FROM plans WHERE id=? OR code=?').bind(data.planId || '', data.planCode || '').first();
  if (!plan) return json({ error: 'Тариф не найден' }, 400);
  const isTrial = plan.code !== 'enterprise';
  const end = new Date(Date.now() + 7 * 86400000).toISOString();
  await env.TEAMDECK_DB.batch([
    env.TEAMDECK_DB.prepare('UPDATE organizations SET billing_email=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(billingEmail, isTrial ? 'trial' : 'pending_payment', organization.id),
    env.TEAMDECK_DB.prepare('INSERT INTO subscriptions (id,organization_id,plan_id,status,trial_end,current_period_end) VALUES (?,?,?,?,?,?)').bind(id(), organization.id, plan.id, isTrial ? 'trial' : 'pending_payment', isTrial ? end : null, isTrial ? end : null)
  ]);
  return json({ ok: true, organizationId: organization.id, status: isTrial ? 'trial' : 'pending_payment', trialEnd: isTrial ? end : null, plan: plan.code });
}
