// Shared legacy-demo runtime state. Must load before feature modules.
var data=(()=>{try{const saved=JSON.parse(localStorage.getItem('hireos-data')||'null');if(saved&&typeof saved==='object')return saved}catch(e){}return TeamdeckData.createInitialData()})();
data.vacancies=Array.isArray(data.vacancies)?data.vacancies:[];
data.candidates=Array.isArray(data.candidates)?data.candidates:[];
data.responses=Array.isArray(data.responses)?data.responses:[];
data.approvalArchive=Array.isArray(data.approvalArchive)?data.approvalArchive:[];
if(typeof extraVacancies!=='undefined')extraVacancies.forEach(v=>{if(!data.vacancies.some(x=>x.id===v.id))data.vacancies.push(v)});
if(typeof extraCandidates!=='undefined')extraCandidates.forEach(c=>{if(!data.candidates.some(x=>x.id===c.id))data.candidates.push(c)});
function save(){localStorage.setItem('hireos-data',JSON.stringify(data))}
function saveResponses(){save()}
function resetAnalyticsFilters(){document.getElementById('analyticsReset')?.classList.add('hidden')}
window.TeamdeckRuntime={get data(){return data},save};
