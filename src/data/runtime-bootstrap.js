// Shared legacy-demo runtime state. Must load before feature modules.
window.data=(()=>{try{const saved=JSON.parse(localStorage.getItem('hireos-data')||'null');if(saved&&typeof saved==='object')return saved}catch(e){}return TeamdeckData.createInitialData()})();
window.data.vacancies=Array.isArray(window.data.vacancies)?window.data.vacancies:[];
window.data.candidates=Array.isArray(window.data.candidates)?window.data.candidates:[];
window.data.responses=Array.isArray(window.data.responses)?window.data.responses:[];
window.data.approvalArchive=Array.isArray(window.data.approvalArchive)?window.data.approvalArchive:[];
if(typeof extraVacancies!=='undefined')extraVacancies.forEach(v=>{if(!window.data.vacancies.some(x=>x.id===v.id))window.data.vacancies.push(v)});
if(typeof extraCandidates!=='undefined')extraCandidates.forEach(c=>{if(!window.data.candidates.some(x=>x.id===c.id))window.data.candidates.push(c)});
function save(){localStorage.setItem('hireos-data',JSON.stringify(window.data))}
function saveResponses(){save()}
function resetAnalyticsFilters(){document.getElementById('analyticsReset')?.classList.add('hidden')}
window.TeamdeckRuntime={get data(){return window.data},save};
