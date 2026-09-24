import { getAppContext, unauthorized, forbidden, writer, body, id, audit, json } from '../../_lib/app.js';

export async function onRequestGet({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized();
  const rows = await env.TEAMDECK_DB.prepare('SELECT e.*, d.name AS department_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id WHERE e.organization_id=? ORDER BY e.last_name,e.first_name').bind(context.organization.id).all();
  return json({ employees: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const data = await body(request); const firstName = String(data.firstName || '').trim(); const lastName = String(data.lastName || '').trim();
  if (!firstName || !lastName) return json({ error: 'Имя и фамилия обязательны' }, 400);
  const employeeId = id();
  await env.TEAMDECK_DB.prepare('INSERT INTO employees (id,organization_id,department_id,first_name,last_name,job_title,email,phone,status,hired_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(employeeId, context.organization.id, data.departmentId || null, firstName, lastName, String(data.jobTitle || '').trim(), String(data.email || '').trim().toLowerCase(), String(data.phone || '').trim(), data.status || 'active', data.hiredAt || null).run();
  await audit(env, context, 'created', 'employee', employeeId, { firstName, lastName });
  return json(await env.TEAMDECK_DB.prepare('SELECT * FROM employees WHERE id=?').bind(employeeId).first(), 201);
}

export async function onRequestPatch({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const data = await body(request); const employeeId = data.id; if (!employeeId) return json({ error: 'Нужен id' }, 400);
  const current = await env.TEAMDECK_DB.prepare('SELECT * FROM employees WHERE id=? AND organization_id=?').bind(employeeId, context.organization.id).first(); if (!current) return json({ error: 'Сотрудник не найден' }, 404);
  const next = { ...current, ...data };
  await env.TEAMDECK_DB.prepare('UPDATE employees SET department_id=?,first_name=?,last_name=?,job_title=?,email=?,phone=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?').bind(next.department_id || next.departmentId || null, next.first_name || next.firstName, next.last_name || next.lastName, next.job_title || next.jobTitle || '', next.email || '', next.phone || '', next.status || 'active', employeeId, context.organization.id).run();
  await audit(env, context, 'updated', 'employee', employeeId, data);
  return json(await env.TEAMDECK_DB.prepare('SELECT * FROM employees WHERE id=?').bind(employeeId).first());
}

export async function onRequestDelete({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const employeeId = new URL(request.url).searchParams.get('id'); if (!employeeId) return json({ error: 'Нужен id' }, 400);
  const result = await env.TEAMDECK_DB.prepare('DELETE FROM employees WHERE id=? AND organization_id=?').bind(employeeId, context.organization.id).run(); if (!result.meta?.changes) return json({ error: 'Сотрудник не найден' }, 404);
  await audit(env, context, 'deleted', 'employee', employeeId); return json({ ok: true });
}
