import {splitDateRange,deduplicate,normalizeAnalysis,acceptsAnalysis} from './core.mjs';
export const API_BASE='https://hubeau.eaufrance.fr/api/v1/qualite_nappes/';
const FIELDS=['bss_id','code_bss','date_debut_prelevement','code_param','nom_param','code_fraction','nom_fraction','resultat','code_remarque_analyse','nom_remarque_analyse','code_unite','symbole_unite','code_qualification','nom_qualification','code_statut_analyse','nom_statut_analyse','code_methode','code_lieu_analyse','code_producteur','nom_producteur','limite_quantification','limite_detection','seuil_saturation'];
export async function fetchJSON(url,{signal,fetcher=fetch}={}){
 for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Hub’Eau : HTTP ${response.status}`);const data=await response.json();if(!Array.isArray(data.data)||!Number.isInteger(data.count))throw Error('Réponse Hub’Eau non reconnue');return data;}
  catch(error){if(signal?.aborted||error.name==='AbortError'||attempt===2)throw error;await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,800*2**attempt);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});}
 }
}
export async function fetchAnalysisRange({ids,params,start,end,signal,onProgress=()=>{},fetcher=fetch}){
 if(!ids.length||!params.length)return [];
 if(params.length>1&&params.map(String).includes('1841')){
  const others=await fetchAnalysisRange({ids,params:params.filter(code=>String(code)!=='1841'),start,end,signal,onProgress,fetcher});
  const cot=await fetchAnalysisRange({ids,params:['1841'],start,end,signal,onProgress,fetcher});
  return deduplicate([...others,...cot]);
 }
 const base=API_BASE+'analyses?'+new URLSearchParams({bss_id:ids.join(','),code_param:params.join(','),date_debut_prelevement:start,date_fin_prelevement:end,code_qualification:'1',fields:FIELDS.join(','),format:'json',size:'2000',...(params.length===1&&String(params[0])==='1841'?{code_fraction:'23'}:{})});
 const options={signal,fetcher};const first=await fetchJSON(base+'&page=1',options);
 if(first.count>20000){
  const range=splitDateRange(start,end);
  if(range){let result=[];for(const [a,b] of range)result.push(...await fetchAnalysisRange({ids,params,start:a,end:b,signal,onProgress,fetcher}));return deduplicate(result);}
  if(ids.length>1){const middle=Math.ceil(ids.length/2);let result=[];for(const part of [ids.slice(0,middle),ids.slice(middle)])result.push(...await fetchAnalysisRange({ids:part,params,start,end,signal,onProgress,fetcher}));return deduplicate(result);}
  if(params.length>1){const middle=Math.ceil(params.length/2);let result=[];for(const part of [params.slice(0,middle),params.slice(middle)])result.push(...await fetchAnalysisRange({ids,params:part,start,end,signal,onProgress,fetcher}));return deduplicate(result);}
  throw Error('Trop de résultats pour un point, un paramètre et une journée. Aucun résultat tronqué n’est affiché.');
 }
 const rows=[...first.data];let page=1;onProgress(rows.length,first.count);
 let next=first.next;
 while(next){page++;const data=await fetchJSON(base+'&page='+page,options);rows.push(...data.data);next=data.next;onProgress(rows.length,first.count);if(page>10)throw Error('Pagination inattendue ; chargement interrompu.');}
 if(rows.length!==first.count)throw Error(`Réponse incomplète (${rows.length}/${first.count}). Réessayez le chargement.`);
 return deduplicate(rows.map(normalizeAnalysis).filter(acceptsAnalysis));
}
