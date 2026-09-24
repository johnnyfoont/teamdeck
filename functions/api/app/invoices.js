import { getSetupContext, id, body, json, unauthorized, sendEmail } from '../../_lib/app.js';

function clean(value) { return String(value || '').trim(); }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; }

export async function onRequestGet({ request, env }) {
  const context = await getSetupContext(request, env);
  if (!context) return unauthorized();
  const membership = context.memberships.find(item => ['owner', 'admin'].includes(item.role));
  if (!membership) return json({ error: 'Недостаточно прав' }, 403);
  const rows = await env.TEAMDECK_DB.prepare('SELECT * FROM invoices WHERE organization_id=? ORDER BY created_at DESC').bind(membership.organization_id).all();
  return json({ invoices: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const context = await getSetupContext(request, env);
  if (!context) return unauthorized();
  const data = await body(request);
  const membership = context.memberships.find(item => ['owner', 'admin'].includes(item.role) && ['draft', 'pending_payment', 'active', 'trial'].includes(item.organization_status));
  if (!membership) return json({ error: 'Сначала создайте организацию' }, 409);
  const organization = await env.TEAMDECK_DB.prepare('SELECT * FROM organizations WHERE id=?').bind(membership.organization_id).first();
  const plan = await env.TEAMDECK_DB.prepare('SELECT * FROM plans WHERE id=? OR code=?').bind(data.planId || '', data.planCode || '').first();
  if (!plan) return json({ error: 'Тариф не найден' }, 400);
  const legalName = clean(data.legalName || organization.legal_name || organization.name);
  const inn = clean(data.inn || organization.inn);
  const billingEmail = clean(data.billingEmail || organization.billing_email || context.user.email).toLowerCase();
  if (!legalName || !inn || !billingEmail) return json({ error: 'Юридическое название, ИНН и e-mail обязательны' }, 400);
  const invoiceId = id();
  const number = `TD-${new Date().getFullYear()}-${invoiceId.slice(0, 8).toUpperCase()}`;
  const amountMinor = money(data.amountMinor || plan.price_minor);
  await env.TEAMDECK_DB.prepare('INSERT INTO invoices (id,organization_id,number,status,billing_email,legal_name,inn,kpp,legal_address,amount_minor,currency,due_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(invoiceId, membership.organization_id, number, 'requested', billingEmail, legalName, inn, clean(data.kpp || organization.kpp) || null, clean(data.legalAddress || organization.legal_address) || null, amountMinor, plan.currency || 'RUB', data.dueDate || null, clean(data.notes) || null).run();
  await env.TEAMDECK_DB.prepare('INSERT INTO subscriptions (id,organization_id,plan_id,status) VALUES (?,?,? ,?) ON CONFLICT(id) DO NOTHING').bind(id(), membership.organization_id, plan.id, 'pending_payment').run();
  let emailSent = false;
  try {
    await sendEmail(env, { to: billingEmail, subject: `Заявка на счёт Teamdeck ${number}`, text: `Здравствуйте!\n\nЗаявка на счёт Teamdeck зарегистрирована.\nНомер: ${number}\nОрганизация: ${legalName}\nИНН: ${inn}\nТариф: ${plan.name}\nСумма: ${(amountMinor / 100).toFixed(2)} ${plan.currency || 'RUB'}\n\nПосле проверки Teamdeck направит счёт и инструкции по оплате.` });
    emailSent = true;
  } catch (_) { /* Gmail binding may be connected after provider setup; invoice remains recorded. */ }
  return json({ invoiceId, number, status: 'requested', billingEmail, emailSent }, 201);
}
