import {PARAMETERS,PRESETS,COLORS,normalize,numberLabel,stationName,validDate,validDateRange,approximatePosition,matchesStation,normalizeAnalysis,acceptsAnalysis,quantified,thresholdKind,resultLabel,groupAnalyses,pickSnapshot,summarize,csvCell,concentrationColor} from './core.mjs';
import {unpackCatalogue,mercatorPoint} from './catalogue.mjs';
import {createStationLayer,installRectangleSelection} from './station-layer.mjs';
import {installMapBackground} from './map-background.mjs';
import {fetchAnalysisRange} from './api.mjs';

const $=id=>document.getElementById(id),boot=globalThis.GROUNDWATER_BOOT_DATA;
const dateLabel=value=>value?new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC'}).format(new Date(value)):'Non renseignée';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pageSize=12,listSize=12;
let stations=[],byId=new Map(),filtered=[],selected=new Set(),params=new Set(PRESETS.essentials),entity='',historyPage=0,listPage=0,multi=false,box=false,charts=[],historyRows=[],historySource='',historyAbort=null,historyGeneration=0,snapshotAbort=null,snapshotGeneration=0,snapshotRows=[],snapshotGroups=[],snapshotChosen=new Map(),snapshotGroup=null,snapshotScale=null,snapshotDate='',snapshotParam='',snapshotTolerance=90,visiblePoints=[],focusId='',map,layer,historyTimer;
const cache=new Map(),aquifers=new Map();

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function setStatus(message,error=false){const area=$('analysis-status');area.replaceChildren();if(!message)return;const item=document.createElement('div');item.className='status-message'+(error?' error':'');const text=document.createElement('span');text.textContent=message;item.append(text);if(error){const button=document.createElement('button');button.textContent='Réessayer';button.onclick=()=>loadHistory(true);item.append(button);}area.append(item);}
function dateRange(){const start=$('date-start').value,end=$('date-end').value;if(!validDateRange(start,end)){$('date-error').textContent='Saisissez deux dates valides, du début à la fin de la période.';$('date-error').hidden=false;return null;}$('date-error').hidden=true;return {start,end};}
function selectedIds(){return [...selected];}
function pageIds(){return selectedIds().slice(historyPage*pageSize,(historyPage+1)*pageSize);}
function colorFor(s){const code=s.codes_entite_hg_bdlisa?.[0]||'';if(!code)return '#8a9b98';let hash=0;for(const ch of code)hash=(hash*31+ch.charCodeAt(0))|0;return COLORS[Math.abs(hash)%COLORS.length];}
function pointColor(s){if(snapshotGroup){const row=snapshotChosen.get(s.bss_id);if(row&&quantified(row)&&snapshotScale)return concentrationColor(row.resultat,snapshotScale[0],snapshotScale[1]);return '#9faeaa';}return colorFor(s);}
function stationLabel(s){return `${stationName(s)} · ${s.bss_id} · ${s.nom_nature_pe||'Type non précisé'}${approximatePosition(s)?' · Position au chef-lieu de commune':''}`;}
function updateHash(){
 const hash=new URLSearchParams();if(selected.size)hash.set('points',selectedIds().join(','));hash.set('params',[...params].join(','));hash.set('du',$('date-start').value);hash.set('au',$('date-end').value);if(entity)hash.set('aquifere',entity);if($('search').value)hash.set('q',$('search').value);if($('nature').value!=='Forage')hash.set('type',$('nature').value);if($('basin').value)hash.set('bassin',$('basin').value);if($('territory').value)hash.set('territoire',$('territory').value);if(!$('recent').checked)hash.set('anciens','1');if($('depth-min').value)hash.set('min',$('depth-min').value);if($('depth-max').value)hash.set('max',$('depth-max').value);
 if(snapshotGroup){hash.set('carte',snapshotParam);hash.set('date',snapshotDate);hash.set('ecart',String(snapshotTolerance));}
 history.replaceState(null,'','#'+hash.toString());
}
function renderParameters(){
 $('parameter-list').replaceChildren();let last='';
 for(const p of PARAMETERS){if(last!==p.group){const title=document.createElement('div');title.className='parameter-group';title.textContent=p.group;$('parameter-list').append(title);last=p.group;}
  const label=document.createElement('label');label.className='parameter-option';label.title=p.description;const check=document.createElement('input');check.type='checkbox';check.value=p.code;check.checked=params.has(p.code);check.onchange=()=>{check.checked?params.add(p.code):params.delete(p.code);parameterChanged();};const text=document.createElement('span');text.textContent=p.short||p.label;label.append(check,text);$('parameter-list').append(label);
 }
 $('mobile-filter-summary').textContent=`${params.size} paramètre${params.size>1?'s':''}`;
 for(const button of document.querySelectorAll('[data-preset]'))button.classList.toggle('active',PRESETS[button.dataset.preset].length===params.size&&PRESETS[button.dataset.preset].every(p=>params.has(p)));
 const previous=$('map-parameter').value;$('map-parameter').replaceChildren();for(const p of PARAMETERS)if(params.has(p.code)){$('map-parameter').add(new Option(p.label,p.code));}if(params.has(previous))$('map-parameter').value=previous;
}
function parameterChanged(){renderParameters();clearSnapshot(false);updateHash();scheduleHistory();}
function filterState(){return {query:normalize($('search').value).trim().split(/\s+/).filter(Boolean),nature:$('nature').value,basin:$('basin').value,territory:$('territory').value,entity,depthMin:$('depth-min').value,depthMax:$('depth-max').value,recent:$('recent').checked,start:$('date-start').value||'2021-01-01'};}
function applyFilters({fit=false}={}){
 const state=filterState();if((state.depthMin!==''&&Number(state.depthMin)<0)||(state.depthMax!==''&&Number(state.depthMax)<0)||(state.depthMin!==''&&state.depthMax!==''&&Number(state.depthMin)>Number(state.depthMax))){toast('Vérifiez les profondeurs minimum et maximum.');return;}
 filtered=stations.filter(s=>matchesStation(s,state));listPage=0;layer.setStations([...new Map([...filtered,...selectedIds().map(id=>byId.get(id))].filter(Boolean).map(s=>[s.bss_id,s])).values()]);
 $('filtered-count').textContent=`${numberLabel(filtered.length)} point${filtered.length>1?'s':''}`;
 $('filter-summary').textContent=`${state.nature||'Tous types'} · ${state.recent?'Dernier suivi depuis '+dateLabel(state.start):'Historique complet'} · tous paramètres`;
 $('aquifer-active').textContent=entity?(aquifers.get(entity)?.name||entity):'Tous les aquifères';$('select-aquifer').disabled=!entity||!filtered.length;$('clear-aquifer').hidden=!entity;
 if(fit)fitPoints(filtered);renderList();updateHash();
}
function fitPoints(points){if(!points.length){toast('Aucun point ne correspond aux filtres.');return;}const metro=points.filter(s=>s.latitude>40&&s.latitude<52&&s.longitude> -6&&s.longitude<12);const chosen=metro.length&&metro.length<points.length&&points.length>100?metro:points;map.fitBounds(L.latLngBounds(chosen.map(s=>[s.latitude,s.longitude])),{padding:[25,25],maxZoom:12});}
function renderList(){
 if(!map)return;const bounds=map.getBounds();visiblePoints=filtered.filter(s=>bounds.contains([s.latitude,s.longitude]));listPage=Math.min(listPage,Math.max(0,Math.ceil(visiblePoints.length/listSize)-1));
 const current=visiblePoints.slice(listPage*listSize,(listPage+1)*listSize);$('station-list').replaceChildren();
 for(const s of current){const button=document.createElement('button');button.className='station-item';button.setAttribute('role','listitem');button.setAttribute('aria-pressed',String(selected.has(s.bss_id)));button.title=stationLabel(s);button.innerHTML=`<span class="station-dot" style="background:${colorFor(s)}"></span><span><strong>${escape(stationName(s))}</strong><small>${escape(s.bss_id)} · ${escape(s.nom_nature_pe||'Type inconnu')}${approximatePosition(s)?' · Commune':''}</small></span>`;button.onclick=event=>selectPoint(s.bss_id,event.shiftKey);$('station-list').append(button);}
 if(!current.length){const text=document.createElement('p');text.className='muted tiny list-empty';text.textContent='Aucun point dans cette zone. Dézoomez ou modifiez les filtres.';$('station-list').append(text);}
 $('nearby-count').textContent=numberLabel(visiblePoints.length)+' points';$('list-prev').disabled=listPage===0;$('list-next').disabled=(listPage+1)*listSize>=visiblePoints.length;$('list-page-label').textContent=visiblePoints.length?`${listPage*listSize+1}–${Math.min((listPage+1)*listSize,visiblePoints.length)} / ${numberLabel(visiblePoints.length)}`:'';
}
function selectPoint(id,additive=false){if(!byId.has(id))return;if(additive||multi){selected.has(id)?selected.delete(id):selected.add(id);}else selected=new Set([id]);focusId=selected.has(id)?id:selectedIds().at(-1)||'';historyPage=0;selectionChanged();}
function selectionChanged(){
 clearSnapshot(false);layer.draw();renderList();renderSelection();renderPoint();updateHash();scheduleHistory();
}
function renderSelection(){
 $('clear-selection').disabled=!selected.size;$('load-history').disabled=!selected.size;
 $('selected-stations').replaceChildren();const ids=pageIds();
 for(const id of ids){const s=byId.get(id),chip=document.createElement('span');chip.className='station-chip';chip.innerHTML=`<span class="chip-dot" style="background:${colorFor(s)}"></span><span>${escape(stationName(s))} · ${escape(id)}</span>`;const button=document.createElement('button');button.setAttribute('aria-label','Retirer '+id);button.textContent='×';button.onclick=()=>{selected.delete(id);historyPage=Math.min(historyPage,Math.max(0,Math.ceil(selected.size/pageSize)-1));focusId=selectedIds().at(-1)||'';selectionChanged();};chip.append(button);$('selected-stations').append(chip);}
 $('history-pages').hidden=selected.size<=pageSize;$('history-prev').disabled=historyPage===0;$('history-next').disabled=(historyPage+1)*pageSize>=selected.size;$('history-page-label').textContent=`Points ${historyPage*pageSize+1}–${Math.min((historyPage+1)*pageSize,selected.size)} sur ${numberLabel(selected.size)} sélectionnés`;
 $('analysis-subtitle').textContent=selected.size?`${numberLabel(selected.size)} point${selected.size>1?'s':''} sélectionné${selected.size>1?'s':''} · ${ids.length} affiché${ids.length>1?'s':''} dans les courbes`:'Sélectionnez un forage pour afficher ses mesures.';
}
function renderPoint(){
 const s=byId.get(focusId);$('point-section').hidden=!s;if(!s)return;
 $('point-title').textContent=stationName(s);$('point-id').textContent=`${s.bss_id} · ${s.code_bss||'Ancien code non renseigné'}`;$('point-source').href='https://ades.eaufrance.fr/Fiche/PtEau?Code='+encodeURIComponent(s.bss_id);
 const facts=[['Type',s.nom_nature_pe||'Non renseigné'],['Profondeur d’investigation',s.profondeur_investigation!=null?numberLabel(s.profondeur_investigation)+' m':'Non renseignée'],['Dernier suivi qualité',dateLabel(s.date_fin_mesure)],['Bassin',s.bassin_dce||'Non renseigné'],['Département',s.nom_departement||s.num_departement||'Non renseigné'],['Mode de gisement',s.nom_mode_gisement||'Non renseigné']];
 $('point-facts').innerHTML=facts.map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
 $('point-location').textContent=approximatePosition(s)?'Position publique au chef-lieu de la commune (précision Sandre 18). Le symbole ne localise pas l’ouvrage réel.':`Coordonnées publiées par ADES · ${String(s.precision_coordonnees)==='0'?'Précision non renseignée':s.precision_coordonnees!=null?'Code de précision Sandre : '+s.precision_coordonnees:'Précision non renseignée'}.`;
 $('point-aquifers').replaceChildren();for(const [i,code] of (s.codes_entite_hg_bdlisa||[]).entries()){const button=document.createElement('button');button.className='aquifer-chip';button.textContent=`${s.noms_entite_hg_bdlisa?.[i]||code} · ${code}`;button.title='Filtrer les points associés à cet aquifère';button.onclick=()=>setAquifer(code);$('point-aquifers').append(button);}if(!s.codes_entite_hg_bdlisa?.length)$('point-aquifers').textContent='Aquifère BDLISA non renseigné.';
}
function setAquifer(code){entity=code;$('aquifer-search').value=aquifers.get(code)?.name||code;$('aquifer-results').hidden=true;applyFilters({fit:true});}
function searchAquifers(){
 const query=normalize($('aquifer-search').value).trim();$('aquifer-results').replaceChildren();if(query.length<2){$('aquifer-results').hidden=true;return;}
 const matches=[...aquifers.values()].filter(a=>normalize(a.name+' '+a.code).includes(query)).sort((a,b)=>b.count-a.count).slice(0,12);
 for(const a of matches){const button=document.createElement('button');button.className='river-result';button.textContent=`${a.name} · ${a.code} · ${numberLabel(a.count)} points au catalogue`;button.onclick=()=>setAquifer(a.code);$('aquifer-results').append(button);}
 if(!matches.length){const p=document.createElement('p');p.className='muted tiny';p.textContent='Aucun aquifère trouvé.';$('aquifer-results').append(p);}$('aquifer-results').hidden=false;
}
function scheduleHistory(){clearTimeout(historyTimer);historyAbort?.abort();historyGeneration++;historyRows=[];$('export-csv').disabled=true;destroyCharts();$('data-details').hidden=true;$('comparison-section').hidden=true;if(selected.size)setStatus('Les analyses vont être chargées…');historyTimer=setTimeout(()=>loadHistory(),200);}
function destroyCharts(){for(const c of charts)c.destroy();charts=[];$('charts').replaceChildren();}
function emptyState(message){destroyCharts();const box=document.createElement('div');box.className='empty-state';const heading=document.createElement('h3');heading.textContent=message;const p=document.createElement('p');p.textContent='Choisissez un point sur la carte ou dans la liste, puis les paramètres et la période.';const button=document.createElement('button');button.className='solid-button';button.textContent='Découvrir un forage en Lorraine →';button.onclick=showExample;box.append(heading,p,button);$('charts').append(box);}
async function loadHistory(force=false){
 clearTimeout(historyTimer);historyAbort?.abort();const generation=++historyGeneration;historyAbort=new AbortController();const signal=historyAbort.signal;
 const ids=pageIds(),range=dateRange();historyRows=[];$('export-csv').disabled=true;destroyCharts();$('data-details').hidden=true;$('comparison-section').hidden=true;
 if(!ids.length){setStatus('');emptyState('Aucun point sélectionné');return;}if(!params.size){setStatus('Choisissez au moins un paramètre.');return;}if(!range){setStatus('Corrigez la période pour charger les analyses.');return;}
 const codes=[...params],key=JSON.stringify([ids.slice().sort(),codes.slice().sort(),range.start,range.end]);
 try{
  let rows,source='Hub’Eau · ADES';
  const example=boot.examples;
  if(!force&&cache.has(key)){rows=cache.get(key);source='Hub’Eau · données déjà chargées';}
  else if(!force&&ids.every(id=>example.ids.includes(id))&&codes.every(code=>example.parameters.includes(code))&&range.start>=example.start&&range.end<=example.end){rows=example.rows.map(normalizeAnalysis).filter(r=>acceptsAnalysis(r)&&ids.includes(r.code_station)&&params.has(r.code_parametre)&&r.date_prelevement.slice(0,10)>=range.start&&r.date_prelevement.slice(0,10)<=range.end);source='Exemple local ADES · extrait le '+dateLabel(example.retrievedAt);}
  else{setStatus('Chargement des analyses ADES…');rows=await fetchAnalysisRange({ids,params:codes,...range,signal,onProgress:(loaded,total)=>{if(generation===historyGeneration)setStatus(`${numberLabel(loaded)} / ${numberLabel(total)} analyses reçues…`);}});cache.set(key,rows);if(cache.size>30)cache.delete(cache.keys().next().value);}
  if(generation!==historyGeneration||signal.aborted)return;
  historyRows=rows;historySource=source;setStatus(rows.length?`${numberLabel(rows.length)} analyses · ${dateLabel(range.start)} au ${dateLabel(range.end)} · ${source}`:`Aucune analyse déclarée « Correcte » pour ces points, ces paramètres et cette période. ${source}`);renderCharts(rows);renderData(rows);renderComparison(rows);$('export-csv').disabled=!rows.length;
 }catch(error){if(signal.aborted||generation!==historyGeneration)return;setStatus('Chargement impossible : '+error.message,true);emptyState('Les analyses n’ont pas pu être chargées');}
}
function renderCharts(rows){
 destroyCharts();const groups=groupAnalyses(rows);$('chart-reading').hidden=!rows.length;
 if(!groups.length){const div=document.createElement('div');div.className='empty-state';div.innerHTML='<h3>Aucune mesure disponible</h3><p>Essayez une période plus large, un autre paramètre ou un autre point d’eau.</p>';$('charts').append(div);return;}
 for(const group of groups){const p=PARAMETERS.find(p=>p.code===group.code);const card=document.createElement('article');card.className='chart-card';card.innerHTML=`<div class="chart-card-head"><h3>${escape(p?.label||group.rows[0].nom_param||group.code)}</h3><span class="unit-badge">${escape(group.unit)}</span></div><p class="chart-description">${escape(p?.description||'')} · ${escape(group.fraction)}</p><div class="chart-canvas"><canvas role="img" aria-label="${escape(p?.label||group.code)} : évolution des résultats par point"></canvas></div><div class="chart-meta"><span>${numberLabel(group.rows.length)} analyses · ${group.rows.filter(quantified).length} quantifiées</span><span>Fraction : ${escape(group.fractionCode||'inconnue')}</span></div>`;
  if(p?.kind==='qualitative'){
   card.querySelector('.unit-badge').textContent='Appréciation visuelle';card.querySelector('.chart-canvas').remove();card.querySelector('.chart-meta').firstElementChild.textContent=numberLabel(group.rows.length)+' observations qualitatives';
   const wrap=document.createElement('div');wrap.className='table-wrap';wrap.innerHTML='<table><thead><tr><th>Prélèvement</th><th>Point</th><th>Turbidité visuelle</th></tr></thead><tbody>'+group.rows.map(r=>`<tr><td>${escape(dateLabel(r.date_prelevement))}</td><td>${escape(stationName(byId.get(r.code_station)||{}))} · ${escape(r.code_station)}</td><td>${escape(resultLabel(r))}</td></tr>`).join('')+'</tbody></table>';card.append(wrap);$('charts').append(card);continue;
  }
  $('charts').append(card);const datasets=[];
  for(const id of pageIds()){const pointRows=group.rows.filter(r=>r.code_station===id),s=byId.get(id);if(!pointRows.length)continue;const color=COLORS[selectedIds().indexOf(id)%COLORS.length],name=stationName(s)+' · '+id;
   datasets.push({label:name,data:pointRows.filter(quantified).map(r=>({x:Date.parse(r.date_prelevement),y:r.resultat,row:r})),borderColor:color,backgroundColor:color,pointRadius:3,pointHoverRadius:5,borderWidth:1.6,tension:0,spanGaps:false,showLine:true});
   const limits=pointRows.filter(r=>!quantified(r)&&Number.isFinite(r.resultat));if(limits.length)datasets.push({label:name+' · seuil / indication',data:limits.map(r=>({x:Date.parse(r.date_prelevement),y:r.resultat,row:r})),borderColor:color,backgroundColor:color,showLine:false,pointStyle:limits.map(r=>thresholdKind(r)==='unknown'?'rectRot':'triangle'),pointRotation:limits.map(r=>thresholdKind(r)==='below'?180:0),pointRadius:5});
  }
  charts.push(new Chart(card.querySelector('canvas'),{
   type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,normalized:false,
    interaction:{mode:'nearest',intersect:false},
    plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:12}},tooltip:{callbacks:{title:items=>items.length?dateLabel(items[0].raw.row.date_prelevement):'',label:item=>`${item.dataset.label} : ${resultLabel(item.raw.row)} ${group.unit}`,afterLabel:item=>item.raw.row.mnemo_remarque||''}}},
    scales:{x:{type:'linear',ticks:{maxTicksLimit:5,callback:value=>dateLabel(Number(value))},grid:{display:false}},y:{title:{display:true,text:group.unit},ticks:{maxTicksLimit:6},grid:{color:'#edf1ed'}}}
   }
  }));
 }
}
function renderData(rows){
 $('data-details').hidden=!rows.length;$('table-count').textContent=numberLabel(rows.length)+' analyses';const display=rows.slice().sort((a,b)=>b.date_prelevement.localeCompare(a.date_prelevement)).slice(0,2000);
 $('data-table').innerHTML=display.map(r=>`<tr><td>${escape(dateLabel(r.date_prelevement))}</td><td>${escape(stationName(byId.get(r.code_station)||{}))}<br>${escape(r.code_station)}</td><td>${escape(r.nom_param||PARAMETERS.find(p=>p.code===r.code_parametre)?.label||r.code_parametre)}</td><td>${escape(resultLabel(r))} ${escape(r.symbole_unite)}</td><td>${escape(r.libelle_fraction)}</td><td>${escape(r.nom_qualification||'Correcte')} · ${escape(r.mnemo_remarque)}</td></tr>`).join('');$('table-note').textContent=rows.length>2000?`Les 2 000 premières lignes sont affichées ; l’export CSV conserve les ${numberLabel(rows.length)} analyses chargées.`:'L’export CSV conserve toutes les analyses chargées et leur date complète de prélèvement.';
}
function renderComparison(rows){
 const groups=groupAnalyses(rows).filter(g=>PARAMETERS.find(p=>p.code===g.code)?.kind!=='qualitative');$('comparison-section').hidden=selected.size<2||!groups.length;$('comparison-content').replaceChildren();if(selected.size<2)return;
 for(const group of groups){const title=document.createElement('h3');title.textContent=(PARAMETERS.find(p=>p.code===group.code)?.label||group.code)+' · '+group.unit+' · '+group.fraction;const wrap=document.createElement('div');wrap.className='table-wrap';wrap.innerHTML='<table><thead><tr><th>Point</th><th>Profondeur déclarée</th><th>Moyenne</th><th>Minimum–maximum</th><th>Quantifiées / exclues</th><th>Période réelle</th></tr></thead><tbody></tbody></table>';
  for(const id of pageIds()){const own=group.rows.filter(r=>r.code_station===id);if(!own.length)continue;const s=byId.get(id),stats=summarize(own),tr=document.createElement('tr');tr.innerHTML=`<td>${escape(stationName(s))}<br>${escape(id)}</td><td>${s.profondeur_investigation!=null?numberLabel(s.profondeur_investigation)+' m':'Non renseignée'}</td><td>${stats.mean==null?'Aucune valeur quantifiée':numberLabel(stats.mean)}</td><td>${stats.min==null?'—':numberLabel(stats.min)+'–'+numberLabel(stats.max)}</td><td>${stats.count} / ${stats.excluded}</td><td>${dateLabel(own[0].date_prelevement)}–${dateLabel(own.at(-1).date_prelevement)}</td>`;wrap.querySelector('tbody').append(tr);}
  $('comparison-content').append(title,wrap);
 }
}
function exportCSV(){
 if(!historyRows.length)return;const headings=['bss_id','ancien_code_bss','commune','nature','precision_coordonnees_sandre','profondeur_investigation_m','aquiferes_bdlisa','date_prelevement','code_parametre','parametre','resultat_numerique_declare','resultat_affiche','code_unite','unite','code_fraction','fraction','code_remarque','remarque','qualification','statut','producteur','limite_quantification','limite_detection','source','date_export'];
 const lines=[headings.map(h=>csvCell(h)).join(';')];for(const r of historyRows){const s=byId.get(r.code_station),values=[s.bss_id,s.code_bss,s.nom_commune,s.nom_nature_pe,s.precision_coordonnees,s.profondeur_investigation,(s.codes_entite_hg_bdlisa||[]).join('|'),r.date_prelevement,r.code_parametre,r.nom_param,r.resultat,resultLabel(r),r.code_unite,r.symbole_unite,r.code_fraction,r.libelle_fraction,r.code_remarque,r.mnemo_remarque,r.nom_qualification,r.nom_statut_analyse,r.nom_producteur,r.limite_quantification,r.limite_detection,'ADES via Hub’Eau',new Date().toISOString()];lines.push(values.map((value,i)=>csvCell(value,![4,5,10,21,22].includes(i))).join(';'));}
 const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='science008-analyses-forages-'+today()+'.csv';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(numberLabel(historyRows.length)+' analyses exportées.');
}
function clearSnapshot(write=true){snapshotAbort?.abort();snapshotGeneration++;snapshotRows=[];snapshotGroups=[];snapshotChosen=new Map();snapshotGroup=null;$('clear-date-view').hidden=true;$('snapshot-fraction-label').hidden=true;$('snapshot-table-wrap').hidden=true;$('map-legend').textContent='● Couleur : premier aquifère associé · Cercle bordé : sélection';$('snapshot-status').textContent='Sélectionnez des points. Le prélèvement le plus proche de la date sera retenu, dans l’écart choisi.';layer?.draw();if(write)updateHash();}
async function loadSnapshot(){
 snapshotAbort?.abort();const generation=++snapshotGeneration;snapshotAbort=new AbortController();const signal=snapshotAbort.signal;const date=$('map-date').value,code=$('map-parameter').value,tolerance=Number($('map-tolerance').value),ids=selectedIds();
 if(!ids.length){$('snapshot-status').textContent='Sélectionnez au moins un point sur la carte ou dans la liste.';return;}if(!validDate(date)||!code){$('snapshot-status').textContent='Choisissez un paramètre et une date valide.';return;}
 snapshotGroup=null;snapshotChosen.clear();layer.draw();$('snapshot-table-wrap').hidden=true;$('snapshot-fraction-label').hidden=true;$('clear-date-view').hidden=false;
 const day=86400000,start=new Date(Date.parse(date)-tolerance*day).toISOString().slice(0,10),end=new Date(Date.parse(date)+tolerance*day).toISOString().slice(0,10);let rows=[];
 try{for(let index=0;index<ids.length;index+=100){$('snapshot-status').textContent=`Chargement de la vue par date : ${index} / ${numberLabel(ids.length)} points…`;const chunk=ids.slice(index,index+100);rows.push(...await fetchAnalysisRange({ids:chunk,params:[code],start,end,signal}));}
  if(signal.aborted||generation!==snapshotGeneration)return;
  snapshotRows=rows;snapshotDate=date;snapshotParam=code;snapshotTolerance=tolerance;snapshotGroups=groupAnalyses(rows);$('snapshot-fraction').replaceChildren();for(const [i,g] of snapshotGroups.entries())$('snapshot-fraction').add(new Option(`${g.unit} · ${g.fraction}`,String(i)));$('snapshot-fraction-label').hidden=snapshotGroups.length<2;
  if(!snapshotGroups.length){$('snapshot-status').textContent='Aucune analyse pour ces points et cette fenêtre de dates.';return;}renderSnapshot(0);updateHash();
 }catch(error){if(signal.aborted||generation!==snapshotGeneration)return;$('snapshot-status').textContent='Chargement impossible : '+error.message;}
}
function renderSnapshot(index){
 snapshotGroup=snapshotGroups[index];if(!snapshotGroup)return;snapshotChosen=pickSnapshot(snapshotGroup.rows,snapshotDate,snapshotTolerance);const values=[...snapshotChosen.values()].filter(quantified).map(r=>r.resultat);snapshotScale=values.length?[Math.min(...values),Math.max(...values)]:null;layer.draw();
 const p=PARAMETERS.find(p=>p.code===snapshotParam),qualitative=p?.kind==='qualitative',unit=qualitative?'':snapshotGroup.unit;$('snapshot-status').textContent=`${p?.label||snapshotParam} · cible : ${dateLabel(snapshotDate)} ± ${snapshotTolerance} jours · ${snapshotChosen.size}/${numberLabel(selected.size)} points avec résultat${qualitative?', observations qualitatives':', dont '+values.length+' quantifiés. Unité : '+unit} · ${snapshotGroup.fraction}.`;
 $('snapshot-table-wrap').hidden=false;$('snapshot-table-summary').textContent=`${snapshotChosen.size} résultats · dates réellement mesurées`;
 $('snapshot-table').innerHTML=selectedIds().slice(0,2000).map(id=>{const r=snapshotChosen.get(id);return `<tr><td>${escape(stationName(byId.get(id)))} · ${escape(id)}</td><td>${r?dateLabel(r.date_prelevement):'Aucun prélèvement dans l’écart accepté'}</td><td>${r?escape(resultLabel(r))+' '+escape(unit):'—'}</td></tr>`;}).join('');
 $('map-legend').innerHTML=qualitative?'Turbidité visuelle : catégories consultables dans le tableau':values.length?`<span>${escape(p?.label)} · ${escape(snapshotGroup.unit)}</span><span class="concentration-scale"></span><span>${numberLabel(Math.min(...values))} → ${numberLabel(Math.max(...values))}</span><span>Gris : absent / non quantifié</span>`:'Gris : aucune valeur quantifiée pour ce groupe';
}
function showExample(){
 const id=boot.examples.ids[0];$('nature').value='Forage';$('search').value='';$('basin').value='';$('territory').value='';$('depth-min').value='';$('depth-max').value='';entity='';$('aquifer-search').value='';$('recent').checked=false;$('date-start').value=boot.examples.start;$('date-end').value=boot.examples.end;params=new Set(PRESETS.essentials);renderParameters();selected=new Set([id]);focusId=id;historyPage=0;applyFilters();selectionChanged();fitPoints([byId.get(id)]);$('analysis').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function initialize(){
 if(!boot?.catalogue)throw Error('Le catalogue local ADES n’a pas été chargé.');
 stations=unpackCatalogue(boot.catalogue);for(const s of stations){s.code_station=s.bss_id;const m=mercatorPoint(s.latitude,s.longitude);s._mercatorX=m.x;s._mercatorY=m.y;byId.set(s.bss_id,s);for(const [i,code] of (s.codes_entite_hg_bdlisa||[]).entries()){if(!aquifers.has(code))aquifers.set(code,{code,name:s.noms_entite_hg_bdlisa?.[i]||code,count:0});aquifers.get(code).count++;}}
 const hash=new URLSearchParams(location.hash.slice(1));const start=hash.get('du')||'2021-01-01',end=hash.get('au')||today();$('date-start').value=validDate(start)?start:'2021-01-01';$('date-end').value=validDate(end)?end:today();$('map-date').value=hash.get('date')||today();
 if(hash.has('params'))params=new Set(hash.get('params').split(',').filter(c=>PARAMETERS.some(p=>p.code===c)));
 for(const [key,id] of [['q','search'],['type','nature'],['territoire','territory'],['min','depth-min'],['max','depth-max']])if(hash.has(key))$(id).value=hash.get(key);
 $('recent').checked=!hash.has('anciens');
 for(const basin of [...new Set(stations.map(s=>s.bassin_dce).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')))$('basin').add(new Option(basin,basin));if(hash.has('bassin'))$('basin').value=hash.get('bassin');
 if(aquifers.has(hash.get('aquifere'))){entity=hash.get('aquifere');$('aquifer-search').value=aquifers.get(entity).name;}
 selected=new Set((hash.get('points')||'').split(',').filter(id=>byId.has(id)));focusId=selectedIds()[0]||'';renderParameters();if(hash.get('carte')&&params.has(hash.get('carte')))$('map-parameter').value=hash.get('carte');if(['0','7','30','90','180'].includes(hash.get('ecart')))$('map-tolerance').value=hash.get('ecart');
 map=L.map('map',{zoomControl:true,scrollWheelZoom:true,preferCanvas:true,boxZoom:false}).setView([46.6,2.4],6);map.createPane('stations');map.getPane('stations').style.zIndex=450;
 L.geoJSON(boot.departments,{style:{color:'#83a6a0',weight:.7,fillColor:'#edf4ec',fillOpacity:.22},interactive:false}).addTo(map);
 installMapBackground(map,{select:$('map-background'),status:$('background-status'),protocol:location.protocol});
 layer=createStationLayer({label:stationLabel,onSelect:selectPoint,style:s=>({selected:selected.has(s.bss_id),color:pointColor(s)})}).addTo(map);
 installRectangleSelection(map,layer,{isActive:()=>box,onBounds:(bounds,id)=>{if(id){selectPoint(id,true);return;}let count=0;for(const s of filtered)if(bounds.contains([s.latitude,s.longitude])){if(!selected.has(s.bss_id))count++;selected.add(s.bss_id);}historyPage=0;focusId=selectedIds().at(-1)||'';selectionChanged();toast(count+' points ajoutés à la sélection.');},onComplete:()=>{box=false;$('box-select').setAttribute('aria-pressed','false');$('map').classList.remove('box-select-active');}});
 map.on('moveend',()=>{listPage=0;renderList();});
 $('total-stations').textContent=numberLabel(stations.filter(s=>s.nom_nature_pe==='Forage').length);$('catalogue-note').textContent=`${numberLabel(stations.length)} points · instantané du ${dateLabel(boot.catalogue.retrievedAt)}`;
 $('coverage-note').textContent=`Dates du catalogue, tous paramètres confondus. ${numberLabel(boot.catalogue.unassignedCount||0)} points sans département exploitable ne sont pas cartographiés.`;
 let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyFilters(),150);};$('search').onkeydown=event=>{if(event.key==='Enter')applyFilters({fit:true});};
 for(const id of ['nature','basin','territory','depth-min','depth-max','recent'])$(id).onchange=()=>applyFilters({fit:id==='territory'});
 for(const id of ['date-start','date-end'])$(id).onchange=()=>{if(dateRange())applyFilters();clearSnapshot(false);scheduleHistory();};
 for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{params=new Set(PRESETS[button.dataset.preset]);parameterChanged();};
 $('five-years').onclick=()=>{const end=today(),start=new Date(end+'T12:00:00Z');start.setUTCFullYear(start.getUTCFullYear()-5);$('date-start').value=start.toISOString().slice(0,10);$('date-end').value=end;dateRange();applyFilters();scheduleHistory();};
 $('reset-filters').onclick=()=>{$('search').value='';$('nature').value='Forage';$('basin').value='';$('territory').value='';$('depth-min').value='';$('depth-max').value='';$('recent').checked=true;entity='';$('aquifer-search').value='';applyFilters();map.setView([46.6,2.4],6);};
 $('fit-stations').onclick=()=>fitPoints(filtered);$('multi-select').onclick=()=>{multi=!multi;$('multi-select').setAttribute('aria-pressed',String(multi));};$('box-select').onclick=()=>{box=!box;$('box-select').setAttribute('aria-pressed',String(box));$('map').classList.toggle('box-select-active',box);if(box)toast('Glissez un rectangle sur la carte pour ajouter les points.');};
 $('clear-selection').onclick=()=>{selected.clear();focusId='';historyPage=0;selectionChanged();};$('load-history').onclick=()=>loadHistory(true);$('export-csv').onclick=exportCSV;
 $('list-prev').onclick=()=>{listPage--;renderList();};$('list-next').onclick=()=>{listPage++;renderList();};$('history-prev').onclick=()=>{historyPage--;renderSelection();scheduleHistory();};$('history-next').onclick=()=>{historyPage++;renderSelection();scheduleHistory();};
 $('aquifer-search').oninput=searchAquifers;$('aquifer-search').onkeydown=event=>{if(event.key==='Escape')$('aquifer-results').hidden=true;};$('clear-aquifer').onclick=()=>{entity='';$('aquifer-search').value='';applyFilters();};$('select-aquifer').onclick=()=>{selected=new Set(filtered.filter(s=>map.getBounds().contains([s.latitude,s.longitude])).map(s=>s.bss_id));historyPage=0;focusId=selectedIds()[0]||'';selectionChanged();};
 document.addEventListener('click',event=>{if(!event.target.closest('.aquifer-search'))$('aquifer-results').hidden=true;});
 $('load-date-view').onclick=loadSnapshot;$('clear-date-view').onclick=()=>clearSnapshot();$('snapshot-fraction').onchange=()=>renderSnapshot(Number($('snapshot-fraction').value));for(const id of ['map-parameter','map-date','map-tolerance'])$(id).onchange=()=>clearSnapshot();
 const places={metro:[[46.6,2.4],6],antilles:[[15.5,-61.1],8],guyane:[[4,-53],7],reunion:[[-21.12,55.5],10],mayotte:[[-12.82,45.15],11]};for(const button of document.querySelectorAll('[data-place]'))button.onclick=()=>{const [center,zoom]=places[button.dataset.place];map.setView(center,zoom);};
 for(const id of ['help-open','help-bottom'])$(id).onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('help-dialog').onclick=event=>{if(event.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('help-dialog').close();}};
 $('example-button').onclick=showExample;const mobileViewport=matchMedia('(max-width:780px)');if(mobileViewport.matches)$('filter-panel').open=false;mobileViewport.addEventListener('change',event=>{$('filter-panel').open=!event.matches;map.invalidateSize();});
 applyFilters();renderSelection();renderPoint();$('map-loading').hidden=true;if(selected.size){fitPoints(selectedIds().map(id=>byId.get(id)));loadHistory();if(hash.get('carte')){$('date-view-panel').open=true;loadSnapshot();}}
 document.querySelector('.skip-link').onclick=event=>{event.preventDefault();$('filters').scrollIntoView();$('search').focus();};
 window.addEventListener('hashchange',()=>location.reload());
}
try{initialize();}catch(error){$('map-loading').hidden=true;$('filtered-count').textContent='Chargement impossible';setStatus(error.message,true);console.error(error);}
