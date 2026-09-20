(function () {
  const defaults = {
    screening: 'Здравствуйте! Спасибо за отклик на вакансию Teamdeck. Мы внимательно изучим ваш опыт и вернёмся с обратной связью по результатам скрининга.',
    reject: 'Спасибо за интерес к вакансии Teamdeck. Сейчас мы не готовы продолжить процесс, но сохраним ваш профиль для будущих возможностей.',
    offer: 'Поздравляем! Мы рады предложить вам присоединиться к команде Teamdeck. Ниже указаны условия, дата выхода и дальнейшие шаги.',
    onboarding: 'Добро пожаловать в Teamdeck! В этом сообщении собраны первые шаги онбординга, необходимые документы и контакты вашей команды.',
    offboarding: 'Спасибо за вклад в развитие Teamdeck. Ниже указаны дальнейшие шаги оффбординга, сроки передачи дел и порядок завершения сотрудничества.'
  };
  let texts = { ...defaults };
  let active = 'screening';
  try {
    const saved = JSON.parse(localStorage.getItem('teamdeck-template-texts') || '{}');
    Object.keys(texts).forEach((key) => { if (typeof saved[key] === 'string') texts[key] = saved[key]; });
  } catch (error) { /* use defaults */ }
  window.teamdeckTemplateTexts = texts;
  window.teamdeckActiveTemplate = active;
  function persist() {
    const editor = document.getElementById('templateEditor');
    if (!editor) return;
    texts[active] = editor.value;
    localStorage.setItem('teamdeck-template-texts', JSON.stringify(texts));
  }
  window.initTemplates = function () {
    const editor = document.getElementById('templateEditor');
    if (editor) editor.value = texts[active];
  };
  window.selectTemplate = function (type, button) {
    persist();
    if (!Object.prototype.hasOwnProperty.call(texts, type)) return;
    active = type;
    window.teamdeckActiveTemplate = type;
    document.querySelectorAll('.template-tab').forEach((item) => item.classList.toggle('active', item === button));
    const editor = document.getElementById('templateEditor');
    if (editor) editor.value = texts[type];
  };
  window.saveTemplateDraft = persist;
  window.saveTemplate = function () { persist(); if (typeof toast === 'function') toast('Шаблон сохранён'); };
  window.initTemplates();
})();
