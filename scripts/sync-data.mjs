import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PARAMETERS} from '../dist/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='https://hubeau.eaufrance.fr/api/v1/qualite_nappes/';
const fields=['bss_id','code_bss','longitude','latitude','precision_coordonnees','code_insee','nom_commune','num_departement','nom_departement','bassin_dce','nom_nature_pe','libelle_pe','profondeur_investigation','date_debut_mesure','date_fin_mesure','codes_entite_hg_bdlisa','noms_entite_hg_bdlisa','codes_masse_eau_rap','noms_masse_eau_rap','nom_mode_gisement','nom_caracteristique_aquifere'];
async function query(endpoint,params){
 const url=base+endpoint+'?'+new URLSearchParams({...params,format:'json'});
 for(let attempt=0;attempt<4;attempt++){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const data=await response.json();if(!Array.isArray(data.data)||!Number.isInteger(data.count))throw Error('Réponse invalide');return data;}
  catch(error){if(attempt===3)throw Error(`${url}: ${error.message}`);await new Promise(r=>setTimeout(r,1000*2**attempt));}
 }
}
async function collect(endpoint,params){
 const rows=[];let page=1,total=null;
 while(true){const data=await query(endpoint,{...params,page,size:5000});total??=data.count;if(total>20000)throw Error(`Découpage nécessaire : ${total} résultats`);rows.push(...data.data);if(!data.next)break;page++;}
 if(rows.length!==total)throw Error(`Collecte incomplète : ${rows.length}/${total}`);return rows;
}
await mkdir(path.join(root,'qa/cache'),{recursive:true});
const departments=JSON.parse(await readFile(path.join(root,'dist/data/departments.geojson'),'utf8')).features.map(f=>String(f.properties.code));
const national=await query('stations',{size:1});
let cursor=0,completed=0;const all=[];const departmentCounts={};
await Promise.all(Array.from({length:4},async()=>{while(cursor<departments.length){
 const department=departments[cursor++],file=path.join(root,'qa/cache',department+'.json');let rows;
 try{rows=JSON.parse(await readFile(file,'utf8'));}catch{rows=await collect('stations',{num_departement:department,fields:fields.join(',')});await writeFile(file,JSON.stringify(rows));}
 all.push(...rows);departmentCounts[department]=rows.length;completed++;if(completed%15===0)console.log(`${completed}/${departments.length} départements`);
}}));
const unique=[...new Map(all.map(s=>[s.bss_id,s])).values()];
const stations=unique.filter(s=>typeof s.longitude==='number'&&typeof s.latitude==='number'&&Math.abs(s.longitude)<=180&&Math.abs(s.latitude)<=85).sort((a,b)=>a.bss_id.localeCompare(b.bss_id));
const catalogue={retrievedAt:new Date().toISOString(),source:base+'stations',apiVersion:national.api_version,sourceCount:national.count,departmentCounts,collectedCount:unique.length,withoutCoordinates:unique.length-stations.length,unassignedCount:Math.max(0,national.count-unique.length),stations};
await writeFile(path.join(root,'qa/stations.json'),JSON.stringify(catalogue));
console.log(JSON.stringify({national:national.count,collected:unique.length,mappable:stations.length,forages:stations.filter(s=>s.nom_nature_pe==='Forage').length,unassigned:catalogue.unassignedCount}));
// A real local example keeps the first exploration available without an API call.
const exampleIds=['BSS000MCQE','BSS000UPPG','BSS000HPVL'];
const parameters=PARAMETERS.map(p=>p.code);
const end=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
const analyses=await collect('analyses',{bss_id:exampleIds.join(','),code_param:parameters.join(','),code_qualification:1,date_debut_prelevement:'2021-01-01',date_fin_prelevement:end});
await writeFile(path.join(root,'dist/data/examples.json'),JSON.stringify({retrievedAt:new Date().toISOString(),ids:exampleIds,start:'2021-01-01',end,parameters,source:base+'analyses',rows:analyses}));
console.log(JSON.stringify({exampleRows:analyses.length,exampleStations:exampleIds}));
