(function () {
  'use strict';

  const STORAGE_KEY = 'teamdeck-action-history';
  const MAX_EVENTS = 120;
  let previous = null;
  let sort = 'newest';
  let scrollTimer = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const nowLabel = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const readArray = (name) => {
    try { return Array.isArray(window[name]) ? window[name] : []; } catch (_) { return []; }
  };
  const currentData = () => {
    try { return typeof data !== 'undefined' ? data : {}; } catch (_) { return {}; }
  };
  const load = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const screening = parsed.filter((item) => item.title === 'Отклик перешёл на этап «Скрининг»');
      const liveData = currentData();
      const liveScreeningNames = new Set((Array.isArray(liveData.candidates) ? liveData.candidates : [])
        .filter((candidate) => candidate.stage === 'Скрининг')
        .map((candidate) => String(candidate.name || '').trim()));
      const cleaned = parsed.filter((item) => {
        if (item.title !== 'Отклик получил отказ') return true;
        const itemName = String(item.detail || '').split(' · ')[0].trim();
        if (liveScreeningNames.has(itemName)) return false;
        return !screening.some((moved) => {
          const samePerson = String(moved.detail || '').split(' · ')[0] === itemName;
          return samePerson && Math.abs(Number(moved.timestamp || 0) - Number(item.timestamp || 0)) <= 120000;
        });
      });
      if (cleaned.length !== parsed.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned.slice(0, MAX_EVENTS)));
      return cleaned;
    } catch (_) { return []; }
  };
  const save = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_EVENTS)));

  function snapshot() {
    const current = currentData();
    const vacancies = Array.isArray(current.vacancies) ? current.vacancies : [];
    const candidates = Array.isArray(current.candidates) ? current.candidates : [];
    const responses = Array.isArray(current.responses) ? current.responses : [];
    const onboarding = readArray('onboardingPeople');
    const offboarding = readArray('offboardingPeople');
    const departments = readArray('companyDepartments');
    const people = readArray('companyPeople');
    return {
      vacancies: Object.fromEntries(vacancies.map((item) => [String(item.id), { title: item.title, status: item.status }])),
      candidates: Object.fromEntries(candidates.map((item) => [String(item.id), { name: item.name, stage: item.stage }])),
      responses: Object.fromEntries(responses.map((item) => [String(item.id), { name: item.name || item.candidate || item.candidateName || 'Отклик', vacancy: item.vacancy }])),
      onboarding: Object.fromEntries(onboarding.map((item) => [String(item.id), { name: item.name, stage: item.stage }])),
      offboarding: Object.fromEntries(offboarding.map((item) => [String(item.id), { name: item.name, stage: item.stage }])),
      departments: Object.fromEntries(departments.map((item) => [String(item.id), { name: item.name || item.title }])),
      people: Object.fromEntries(people.map((item) => [String(item.id), { name: item.name, department: item.department || item.dept || item.departmentId }])),
    };
  }

  function addEvent(type, title, detail) {
    const items = load();
    items.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, title, detail, time: nowLabel(), timestamp: Date.now() });
    save(items);
    render();
  }

  function diffMap(before, after, onAdded, onRemoved, onChanged) {
    Object.keys(after).filter((key) => !before[key]).forEach((key) => onAdded(after[key], key));
    Object.keys(before).filter((key) => !after[key]).forEach((key) => onRemoved(before[key], key));
    Object.keys(after).filter((key) => before[key] && JSON.stringify(before[key]) !== JSON.stringify(after[key])).forEach((key) => onChanged(before[key], after[key], key));
  }

  function compare(before, after) {
    if (!before || !after) return;
    diffMap(before.vacancies, after.vacancies,
      (item) => addEvent('vacancy', 'Добавлена новая вакансия', item.title),
      (item) => addEvent('vacancy', item.status === 'Закрыта' ? 'Вакансия закрыта' : 'Вакансия удалена', item.title),
      (oldItem, item) => { if (oldItem.status !== item.status && item.status === 'Закрыта') addEvent('vacancy', 'Вакансия закрыта', item.title); });

    const removedResponses = [];
    diffMap(before.responses, after.responses,
      (item) => { addEvent('candidate', 'Получен новый отклик', `${item.name}${item.vacancy ? ` · ${item.vacancy}` : ''}`); },
      (item) => { removedResponses.push(item); },
      () => {});

    const movedResponseNames = new Set();
    diffMap(before.candidates, after.candidates,
      (item) => {
        const moved = removedResponses.find((response) => response.name === item.name && item.stage === 'Скрининг');
        if (moved) {
          movedResponseNames.add(moved.name);
          addEvent('candidate', 'Отклик перешёл на этап «Скрининг»', `${item.name}${moved.vacancy ? ` · ${moved.vacancy}` : ''}`);
        } else addEvent('candidate', 'Добавлен новый кандидат', item.name);
      },
      (item) => addEvent('candidate', 'Кандидат удалён', item.name),
      (oldItem, item) => {
        if (oldItem.stage === item.stage) return;
        const finalStage = item.stage === 'Нанято';
        addEvent('candidate', finalStage ? 'Кандидат принял оффер и перешёл в онбординг' : 'Кандидат перешёл на новый этап', `${item.name} · ${item.stage}`);
      });

    removedResponses.filter((item) => !movedResponseNames.has(item.name)).forEach((item) => {
      addEvent('candidate', 'Отклик получил отказ', `${item.name}${item.vacancy ? ` · ${item.vacancy}` : ''}`);
    });

    const onboardingStages = readArray('onboardingStages');
    diffMap(before.onboarding, after.onboarding,
      (item) => addEvent('onboarding', 'Сотрудник начал онбординг', item.name),
      (item) => addEvent('onboarding', 'Сотрудник завершил онбординг и приступил к обязанностям', item.name),
      (oldItem, item) => {
        if (oldItem.stage === item.stage) return;
        const finalStage = onboardingStages.length && Number(item.stage) >= onboardingStages.length - 1;
        addEvent('onboarding', finalStage ? 'Сотрудник прошёл онбординг и приступил к обязанностям' : 'Сотрудник перешёл на новый этап онбординга', `${item.name}${onboardingStages[item.stage] ? ` · ${onboardingStages[item.stage]}` : ''}`);
      });

    const offboardingStages = readArray('offboardingStages');
    diffMap(before.offboarding, after.offboarding,
      (item) => addEvent('offboarding', 'Сотрудник начал оффбординг', item.name),
      (item) => addEvent('offboarding', 'Сотрудник завершил работу в компании', item.name),
      (oldItem, item) => {
        if (oldItem.stage === item.stage) return;
        const finalStage = offboardingStages.length && Number(item.stage) >= offboardingStages.length - 1;
        addEvent('offboarding', finalStage ? 'Сотрудник завершил работу в компании' : 'Сотрудник перешёл на новый этап оффбординга', `${item.name}${offboardingStages[item.stage] ? ` · ${offboardingStages[item.stage]}` : ''}`);
      });

    diffMap(before.departments, after.departments,
      (item) => addEvent('organization', 'Создан новый департамент', item.name),
      (item) => addEvent('organization', 'Департамент удалён', item.name),
      () => {});
    diffMap(before.people, after.people, () => {}, () => {}, (oldItem, item) => {
      if (oldItem.department !== item.department) addEvent('organization', 'Сотрудник перемещён в другой департамент', `${item.name}${item.department ? ` · ${item.department}` : ''}`);
    });
  }

  function render() {
    const host = document.getElementById('actionHistoryList');
    if (!host) return;
    const items = load().sort((a, b) => sort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    host.innerHTML = items.length ? items.slice(0, 12).map((item, index) => `<div class="action-history-event event-type-${esc(item.type)} ${index === 0 && sort === 'newest' ? 'is-latest' : ''}"><div class="action-history-time">${esc(item.time)}</div><div class="action-history-copy"><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></div></div>`).join('') : '<div class="action-history-empty">Изменения в системе появятся здесь</div>';
    if (!scrollTimer) {
      scrollTimer = window.setInterval(() => { if (host.scrollHeight > host.clientHeight) host.scrollTo({ top: host.scrollTop >= host.scrollHeight - host.clientHeight - 4 ? 0 : host.scrollTop + 76, behavior: 'smooth' }); }, 2000);
    }
  }

  function openHistory() {
    const content = document.getElementById('modalContent');
    if (!content) return;
    content.innerHTML = `<div class="modalhead"><div><h2>История действий</h2><span class="mini">Изменения в рабочем пространстве</span></div><button class="close" type="button" onclick="closeModal()">×</button></div><div class="action-history-toolbar"><button type="button" class="btn ${sort === 'newest' ? 'primary' : ''}" onclick="window.teamdeckHistorySort('newest')">Сначала новые</button><button type="button" class="btn ${sort === 'oldest' ? 'primary' : ''}" onclick="window.teamdeckHistorySort('oldest')">Сначала старые</button></div><div class="action-history-modal-list">${load().sort((a, b) => sort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp).map((item) => `<div class="action-history-event event-type-${esc(item.type)}"><div class="action-history-time">${esc(item.time)}</div><div class="action-history-copy"><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></div></div>`).join('') || '<div class="action-history-empty">Событий пока нет</div>'}</div>`;
    openModal();
  }

  window.teamdeckHistorySort = (value) => { sort = value; openHistory(); };
  window.openActionHistory = openHistory;
  window.renderActionHistory = render;

  function start() {
    render();
    window.setTimeout(() => { previous = snapshot(); window.setInterval(() => { const next = snapshot(); compare(previous, next); previous = next; }, 500); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
