import { getAppContext, unauthorized, bootstrap, seedDepartments, json } from '../../_lib/app.js';

export async function onRequestGet({ request, env }) {
  const context = await getAppContext(request, env);
  if (!context) return unauthorized();
  await seedDepartments(env, context);
  return json(await bootstrap(env, context));
}
