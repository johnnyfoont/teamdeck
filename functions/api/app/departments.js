import { getAppContext, unauthorized, forbidden, writer, body, id, audit, json } from '../../_lib/app.js';

export async function onRequestGet({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized();
  const rows = await env.TEAMDECK_DB.prepare('SELECT * FROM departments WHERE organization_id=? ORDER BY name').bind(context.organization.id).all();
  return json({ departments: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const data = await body(request); const name = String(data.name || '').trim(); if (!name) return json({ error: 'Название департамента обязательно' }, 400);
  const departmentId = id();
  await env.TEAMDECK_DB.prepare('INSERT INTO departments (id,organization_id,name,parent_id) VALUES (?,?,?,?)').bind(departmentId, context.organization.id, name, data.parentId || null).run();
  await audit(env, context, 'created', 'department', departmentId, { name });
  return json(await env.TEAMDECK_DB.prepare('SELECT * FROM departments WHERE id=?').bind(departmentId).first(), 201);
}

export async function onRequestPatch({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const data = await body(request); const departmentId = data.id; const name = String(data.name || '').trim(); if (!departmentId || !name) return json({ error: 'Нужны id и название' }, 400);
  const result = await env.TEAMDECK_DB.prepare('UPDATE departments SET name=?, parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?').bind(name, data.parentId || null, departmentId, context.organization.id).run();
  if (!result.meta?.changes) return json({ error: 'Департамент не найден' }, 404);
  await audit(env, context, 'updated', 'department', departmentId, { name });
  return json(await env.TEAMDECK_DB.prepare('SELECT * FROM departments WHERE id=?').bind(departmentId).first());
}

export async function onRequestDelete({ request, env }) {
  const context = await getAppContext(request, env); if (!context) return unauthorized(); if (!writer(context)) return forbidden();
  const idValue = new URL(request.url).searchParams.get('id'); if (!idValue) return json({ error: 'Нужен id' }, 400);
  const member = await env.TEAMDECK_DB.prepare('SELECT COUNT(*) AS count FROM employees WHERE department_id=? AND organization_id=?').bind(idValue, context.organization.id).first();
  if (Number(member?.count)) return json({ error: 'Сначала переместите сотрудников из департамента' }, 409);
  const result = await env.TEAMDECK_DB.prepare('DELETE FROM departments WHERE id=? AND organization_id=?').bind(idValue, context.organization.id).run();
  if (!result.meta?.changes) return json({ error: 'Департамент не найден' }, 404);
  await audit(env, context, 'deleted', 'department', idValue);
  return json({ ok: true });
}
