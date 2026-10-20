import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAnalysisRange} from '../dist/api.mjs';
const args={ids:['BSS1'],params:['1340'],start:'2024-01-01',end:'2024-01-02'};
const raw={bss_id:'BSS1',code_param:1340,resultat:7,code_remarque_analyse:1,date_debut_prelevement:'2024-01-01T00:00:00Z',code_qualification:'1'};
const response=data=>({ok:true,json:async()=>data});
test('HTTP 206 est une réponse partielle valide et toutes les pages sont chargées',async()=>{let calls=0;const rows=await fetchAnalysisRange({...args,fetcher:async()=>{calls++;return response(calls===1?{count:2,data:[raw],next:'next'}:{count:2,data:[{...raw,resultat:8}],next:null});}});assert.equal(calls,2);assert.equal(rows.length,2);assert.equal(rows[0].code_station,'BSS1');});
test('Un total supérieur à 20 000 est découpé en périodes',async()=>{const calls=[];const rows=await fetchAnalysisRange({...args,fetcher:async url=>{const q=new URL(url).searchParams;calls.push(q);return response(q.get('date_debut_prelevement')!==q.get('date_fin_prelevement')?{count:25000,data:[],next:'next'}:{count:1,data:[{...raw,date_debut_prelevement:q.get('date_debut_prelevement')+'T00:00:00Z'}],next:null});}});assert.equal(calls.length,3);assert.equal(rows.length,2);});
test('Une réponse incomplète déclenche une erreur, sans troncature silencieuse',async()=>{await assert.rejects(fetchAnalysisRange({...args,fetcher:async()=>response({count:2,data:[raw],next:null})}),/incomplète/);});
test('Débordement journalier irréductible signalé',async()=>{await assert.rejects(fetchAnalysisRange({...args,end:args.start,fetcher:async()=>response({count:25000,data:[],next:'next'})}),/Trop de résultats/);});
test('Le COT porte sur l’eau brute sans restreindre les fractions des autres paramètres',async()=>{
 const calls=[];
 const rows=await fetchAnalysisRange({...args,params:['1340','1841'],fetcher:async url=>{const query=new URL(url).searchParams;calls.push(query);const cot=query.get('code_param')==='1841';return response({count:cot?2:1,data:cot?[{...raw,code_param:1841,code_fraction:23},{...raw,code_param:1841,code_fraction:3}]:[{...raw,code_fraction:3}],next:null});}});
 assert.equal(calls.find(q=>q.get('code_param')==='1841').get('code_fraction'),'23');
 assert.equal(calls.find(q=>q.get('code_param')==='1340').has('code_fraction'),false);
 assert.deepEqual(rows.map(r=>[r.code_parametre,r.code_fraction]),[['1340',3],['1841',23]]);
});
