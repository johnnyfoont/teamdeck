import { getSetupContext, unauthorized, json } from '../../_lib/app.js';

export async function onRequestGet({ request, env }) {
  const context = await getSetupContext(request, env);
  if (!context) return unauthorized();
  const inn = new URL(request.url).searchParams.get('inn')?.trim() || '';
  if (!/^\d{10}(\d{2})?$/.test(inn)) return json({ error: 'Введите ИНН из 10 или 12 цифр' }, 400);
  if (!env.DADATA_API_KEY) return json({ error: 'Поиск по ИНН пока не подключён: требуется серверный ключ провайдера DaData', code: 'LOOKUP_NOT_CONFIGURED' }, 503);
  const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', { method: 'POST', headers: { Authorization: `Token ${env.DADATA_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: inn, count: 5 }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: 'Провайдер данных временно недоступен' }, 502);
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  return json({ source: 'dadata', checkedAt: new Date().toISOString(), results: suggestions.map(item => { const d = item.data || {}; return { value: item.value || '', name: d.name?.full_with_opf || d.name?.full || item.value || '', shortName: d.name?.short_with_opf || d.name?.short || '', inn: d.inn || inn, kpp: d.kpp || '', ogrn: d.ogrn || '', status: d.state?.status || '', address: d.address?.value || '', management: d.management?.name || '', okved: d.okved || '' }; }) });
}
