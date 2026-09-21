(function(){
  'use strict';
  const SELECT_IDS=['candFilter','analyticsPeriod','analyticsDepartment','analyticsRecruiter'];
  let openWrap=null;

  function closeOpen(){
    if(!openWrap)return;
    openWrap.classList.remove('open');
    const trigger=openWrap.querySelector('.platform-select-trigger');
    if(trigger)trigger.setAttribute('aria-expanded','false');
    openWrap=null;
  }

  function enhance(select){
    if(!select||select.dataset.platformSelect==='true')return;
    select.dataset.platformSelect='true';
    const wrap=document.createElement('div');
    wrap.className='platform-select';
    wrap.dataset.selectId=select.id;
    select.parentNode.insertBefore(wrap,select);
    wrap.appendChild(select);

    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='platform-select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.innerHTML='<span class="platform-select-value"></span><span class="platform-select-chevron" aria-hidden="true"></span>';
    wrap.appendChild(trigger);

    const menu=document.createElement('div');
    menu.className='platform-select-menu';
    menu.setAttribute('role','listbox');
    wrap.appendChild(menu);

    function render(){
      const value=select.value;
      const selected=Array.from(select.options).find(o=>o.value===value)||select.options[select.selectedIndex];
      const label=wrap.querySelector('.platform-select-value');
      if(label)label.textContent=selected?selected.textContent:'';
      menu.innerHTML=Array.from(select.options).map((option,index)=>`<button type="button" class="platform-select-option ${option.value===value?'selected':''}" role="option" aria-selected="${option.value===value}" data-value="${String(option.value).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${option.value===value?'<span class="platform-select-check">✓</span>':'<span class="platform-select-check"></span>'}<span>${option.textContent}</span></button>`).join('');
    }
    render();

    trigger.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      if(wrap.classList.contains('open')){closeOpen();return}
      closeOpen();
      wrap.classList.add('open');
      trigger.setAttribute('aria-expanded','true');
      openWrap=wrap;
      const active=menu.querySelector('.selected');
      if(active)active.scrollIntoView({block:'nearest'});
    });
    menu.addEventListener('click',function(event){
      const option=event.target.closest('.platform-select-option');
      if(!option)return;
      event.preventDefault();
      select.value=option.dataset.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      render();
      closeOpen();
    });
    select.addEventListener('change',render);
  }

  function init(){SELECT_IDS.forEach(id=>enhance(document.getElementById(id)))}
  document.addEventListener('click',function(event){if(openWrap&&!event.target.closest('.platform-select'))closeOpen()});
  document.addEventListener('keydown',function(event){if(event.key==='Escape')closeOpen()});
  document.addEventListener('DOMContentLoaded',init);
  window.initPlatformSelects=init;
})();
