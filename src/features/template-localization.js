(function(){
  'use strict';
  const russianDefaults={
    screening:'Здравствуйте! Спасибо за отклик на вакансию Teamdeck. Мы внимательно изучим ваш опыт и вернёмся с обратной связью по результатам скрининга.',
    reject:'Спасибо за интерес к вакансии Teamdeck. Сейчас мы не готовы продолжить процесс, но сохраним ваш профиль для будущих возможностей.',
    offer:'Поздравляем! Мы рады предложить вам присоединиться к команде Teamdeck. Ниже указаны условия, дата выхода и дальнейшие шаги.',
    onboarding:'Добро пожаловать в Teamdeck! В этом сообщении собраны первые шаги онбординга, необходимые документы и контакты вашей команды.',
    offboarding:'Спасибо за вклад в развитие Teamdeck. Ниже указаны дальнейшие шаги оффбординга, сроки передачи дел и порядок завершения сотрудничества.'
  };
  const englishDefaults={
    screening:'Hello! Thank you for applying for a Teamdeck position. We will carefully review your experience and get back to you with feedback after the screening stage.',
    reject:'Thank you for your interest in a Teamdeck position. We are not ready to continue the process at this time, but we will keep your profile in mind for future opportunities.',
    offer:'Congratulations! We are pleased to offer you the opportunity to join the Teamdeck team. Below you will find the terms, start date and next steps.',
    onboarding:'Welcome to Teamdeck! This message contains the first onboarding steps, required documents and your team contacts.',
    offboarding:'Thank you for your contribution to Teamdeck. Below you will find the next offboarding steps, handover deadlines and the process for completing our collaboration.'
  };
  const baseKey='teamdeck-template-texts';
  const englishKey='teamdeck-template-texts-en';
  let active=window.teamdeckActiveTemplate||'screening';

  function language(){
    try{return JSON.parse(localStorage.getItem('teamdeck-interface-preferences')||'{}').language==='en'?'en':'ru'}catch(e){return 'ru'}
  }
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(e){return {}}}
  function storeKey(){return language()==='en'?englishKey:baseKey}
  function values(){
    const defaults=language()==='en'?englishDefaults:russianDefaults;
    const saved=read(storeKey());
    const result={...defaults};
    Object.keys(defaults).forEach(key=>{if(typeof saved[key]==='string')result[key]=saved[key]});
    return result;
  }
  function editor(){return document.getElementById('templateEditor')}
  function render(){
    const input=editor();
    if(input)input.value=values()[active]||'';
    window.teamdeckActiveTemplate=active;
    window.teamdeckTemplateTexts=values();
  }
  function saveDraft(){
    const input=editor();
    if(!input)return;
    const saved=read(storeKey());
    saved[active]=input.value;
    localStorage.setItem(storeKey(),JSON.stringify(saved));
    window.teamdeckTemplateTexts={...values(),[active]:input.value};
  }
  function select(type,button){
    saveDraft();
    if(!Object.prototype.hasOwnProperty.call(russianDefaults,type))return;
    active=type;
    document.querySelectorAll('.template-tab').forEach(item=>item.classList.toggle('active',item===button));
    render();
  }
  function install(){
    if(!document.getElementById('templateEditor'))return;
    // Replace the legacy handlers so each language has its own editable draft.
    window.selectTemplate=select;
    window.saveTemplateDraft=saveDraft;
    window.saveTemplate=function(){saveDraft();if(typeof toast==='function')toast(language()==='en'?'Template saved':'Шаблон сохранён')};
    render();
  }
  window.addEventListener('load',install,{once:true});
  window.addEventListener('teamdeck:language-changed',install);
})();
