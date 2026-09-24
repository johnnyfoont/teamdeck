import { getSessionUser, sha256, body, json, unauthorized, id } from '../../../_lib/app.js';

export async function onRequestPost({ request, env }) {
  const auth = await getSessionUser(request, env);
  if (!auth) return unauthorized();
  const data = await body(request);
  const rawToken = String(data.token || '').trim();
  if (!rawToken) return json({ error: 'Токен приглашения отсутствует' }, 400);
  const invitation = await env.TEAMDECK_DB.prepare('SELECT * FROM invitations WHERE token_hash=? AND status="pending"').bind(await sha256(rawToken)).first();
  if (!invitation) return json({ error: 'Приглашение не найдено или уже использовано' }, 404);
  if (new Date(invitation.expires_at).getTime() < Date.now()) return json({ error: 'Срок действия приглашения истёк' }, 410);
  if (String(invitation.email).toLowerCase() !== auth.email) return json({ error: 'Войдите под тем e-mail, на который отправлено приглашение' }, 403);
  await env.TEAMDECK_DB.batch([
    env.TEAMDECK_DB.prepare('INSERT INTO memberships (id,organization_id,user_id,role,status) VALUES (?,?,?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status').bind(id(), invitation.organization_id, auth.userId, invitation.role, 'active'),
    env.TEAMDECK_DB.prepare('UPDATE invitations SET status="accepted",accepted_at=CURRENT_TIMESTAMP WHERE id=?').bind(invitation.id)
  ]);
  return json({ ok: true, organizationId: invitation.organization_id, role: invitation.role });
}
