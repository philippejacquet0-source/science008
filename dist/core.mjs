export const PARAMETERS=[
 {code:'1340',label:'Nitrates',group:'Usuels',description:'Une forme d’azote dissous ; les apports et les transformations dépendent du contexte de la nappe.'},
 {code:'1302',label:'pH',group:'Usuels',description:'L’acidité ou l’alcalinité de l’eau.'},
 {code:'1303',label:'Conductivité à 25 °C',short:'Conductivité',group:'Usuels',description:'Un indicateur de la quantité d’ions dissous, à une température de référence de 25 °C.'},
 {code:'1301',label:'Température',group:'Usuels',description:'La température de l’eau au moment du prélèvement.'},
 {code:'1335',label:'Ammonium',group:'Usuels',description:'Une forme d’azote dont la présence dépend aussi des conditions chimiques naturelles de la nappe.'},
 {code:'1295',label:'Turbidité',group:'Usuels',description:'Turbidité par néphélométrie à la formazine : une mesure optique du trouble de l’eau. Les unités NFU et NTU restent distinctes.'},
 {code:'1841',label:'Carbone organique total (COT)',short:'Carbone organique total',group:'Usuels',description:'Carbone organique mesuré sur l’eau brute (fraction 23). Les mesures sur eau filtrée, correspondant au carbone organique dissous, ne sont pas retenues pour ce paramètre.'},
 {code:'1337',label:'Chlorures',group:'Minéralisation',description:'Des ions dissous qui participent à la minéralisation de l’eau.'},
 {code:'1338',label:'Sulfates',group:'Minéralisation',description:'Des ions dissous liés à la géologie et aux apports dans la nappe.'},
 {code:'1374',label:'Calcium',group:'Minéralisation',description:'Un élément dissous qui contribue à la dureté de l’eau.'},
 {code:'1372',label:'Magnésium',group:'Minéralisation',description:'Un élément dissous qui contribue à la dureté de l’eau.'},
 {code:'1375',label:'Sodium',group:'Minéralisation',description:'Un élément dissous utile pour décrire la composition minérale de l’eau.'},
 {code:'1345',label:'Dureté totale (TH)',short:'Dureté totale',group:'Minéralisation',description:'La dureté totale, ou titre hydrotimétrique, décrit la teneur en calcium et magnésium. La mesure déclarée est conservée dans son unité d’origine.'},
 {code:'1347',label:'Titre alcalimétrique complet (TAC)',short:'Alcalinité (TAC)',group:'Minéralisation',description:'Le TAC décrit l’alcalinité liée aux hydroxydes, carbonates et bicarbonates. La mesure déclarée est conservée dans son unité d’origine.'},
 {code:'1393',label:'Fer',group:'Métaux',description:'Un élément dont la présence peut être naturelle, selon la roche et les conditions d’oxydoréduction.'},
 {code:'1394',label:'Manganèse',group:'Métaux',description:'Un élément sensible aux conditions d’oxydoréduction dans la nappe.'},
 {code:'1369',label:'Arsenic',group:'Métaux',description:'Un élément pouvant provenir des formations géologiques ou d’apports extérieurs.'},
 {code:'1386',label:'Nickel',group:'Métaux',description:'Un métal recherché dans le suivi chimique de certaines eaux souterraines.'},
 {code:'1382',label:'Plomb',group:'Métaux',description:'Un métal recherché dans le suivi chimique de certaines eaux souterraines.'},
 {code:'1107',label:'Atrazine',group:'Pesticides',description:'Un herbicide recherché dans les suivis des eaux souterraines.'},
 {code:'1108',label:'Atrazine déséthyl',group:'Pesticides',description:'Un produit de dégradation de l’atrazine.'},
 {code:'1506',label:'Glyphosate',group:'Pesticides',description:'Un herbicide ; sa disponibilité dépend du programme de suivi.'},
 {code:'1907',label:'AMPA',group:'Pesticides',description:'Un produit de dégradation de certains composés phosphonatés, dont le glyphosate.'},
 {code:'1221',label:'Métolachlore total',group:'Pesticides',description:'Un herbicide recherché dans certains programmes de suivi.'}
];
export const PRESETS={essentials:['1340','1302','1303','1301','1393','1394','1345','1347','1295','1841'],minerals:['1337','1338','1374','1372','1375'],metals:['1393','1394','1369','1386','1382'],pesticides:['1107','1108','1506','1907','1221'],all:PARAMETERS.map(p=>p.code)};
export function acceptsAnalysis(row){return String(row.code_parametre??row.code_param)!=='1841'||String(row.code_fraction)==='23';}
export const COLORS=['#c8754d','#238c99','#8773ac','#438e67','#a98d35','#a36087','#537fc2','#707c43','#ab503e','#345987','#786055','#398674'];
export const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ');
export const numberLabel=v=>new Intl.NumberFormat('fr-FR',{maximumSignificantDigits:6}).format(v);
export const stationName=s=>s.nom_commune||s.libelle_pe||s.bss_id;
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validDateRange(a,b){return validDate(a)&&validDate(b)&&a<=b;}
export function approximatePosition(s){return String(s.precision_coordonnees)==='18';}
export function searchText(s){return normalize([s.bss_id,s.code_bss,s.nom_commune,s.nom_departement,s.num_departement,s.libelle_pe,...(s.codes_entite_hg_bdlisa||[]),...(s.noms_entite_hg_bdlisa||[]),...(s.codes_masse_eau_rap||[]),...(s.noms_masse_eau_rap||[])].join(' '));}
export function matchesStation(s,{query='',basin='',territory='',nature='Forage',entity='',depthMin='',depthMax='',recent=false,start='2021-01-01'}={}){
 if(nature&&s.nom_nature_pe!==nature)return false;
 if(basin&&s.bassin_dce!==basin)return false;
 if(territory==='metro'&&(/^9[78]/.test(String(s.num_departement))||s.latitude<40||s.latitude>52||s.longitude>12||s.longitude< -6))return false;
 if(territory&&territory!=='metro'&&s.num_departement!==territory)return false;
 if(entity&&!(s.codes_entite_hg_bdlisa||[]).includes(entity))return false;
 const depth=s.profondeur_investigation;
 if(depthMin!==''&&(depth==null||depth<Number(depthMin)))return false;
 if(depthMax!==''&&(depth==null||depth>Number(depthMax)))return false;
 if(recent&&(!s.date_fin_mesure||s.date_fin_mesure.slice(0,10)<start))return false;
 const words=Array.isArray(query)?query:normalize(query).trim().split(/\s+/).filter(Boolean);
 const haystack=s._search??=searchText(s);return words.every(word=>haystack.includes(word));
}
export function normalizeAnalysis(row){return {...row,code_station:row.bss_id,code_parametre:String(row.code_param),date_prelevement:row.date_debut_prelevement,code_remarque:String(row.code_remarque_analyse),mnemo_remarque:row.nom_remarque_analyse,libelle_fraction:row.nom_fraction,resultat:typeof row.resultat==='number'&&Number.isFinite(row.resultat)?row.resultat:null};}
export function quantified(row){return String(row.code_remarque)==='1'&&Number.isFinite(row.resultat);}
export function thresholdKind(row){
 if(quantified(row))return null;
 const label=normalize(row.mnemo_remarque);
 if(label.includes('inferieur')||/^\s*</.test(label)||['2','5'].includes(String(row.code_remarque)))return 'below';
 if(label.includes('superieur')||/^\s*>/.test(label)||String(row.code_remarque)==='4')return 'above';
 return 'unknown';
}
export function resultLabel(row){if(!Number.isFinite(row.resultat))return 'Non renseigné';const type=thresholdKind(row);return (type==='below'?'< ':type==='above'?'> ':type==='unknown'?'Indication : ':'')+numberLabel(row.resultat);}
export function analysisKey(r){return JSON.stringify([r.code_station,r.code_parametre,r.date_prelevement,r.code_fraction,r.code_unite,r.resultat,r.code_remarque,r.code_methode,r.code_lieu_analyse,r.code_producteur]);}
export function deduplicate(rows){const seen=new Set();return rows.filter(r=>{const key=analysisKey(r);if(seen.has(key))return false;seen.add(key);return true;});}
export function groupAnalyses(rows){const groups=new Map();for(const row of rows){if(String(row.code_qualification)!=='1')continue;const key=JSON.stringify([row.code_parametre,String(row.code_unite??''),row.symbole_unite??'',String(row.code_fraction??'')]);if(!groups.has(key))groups.set(key,{key,code:row.code_parametre,unit:row.symbole_unite||'Unité non précisée',unitCode:String(row.code_unite??''),fraction:row.libelle_fraction||'Fraction non précisée',fractionCode:String(row.code_fraction??''),rows:[]});groups.get(key).rows.push(row);}return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>a.date_prelevement.localeCompare(b.date_prelevement))}));}
export function splitDateRange(start,end){if(start>=end)return null;const day=86400000,first=Date.parse(start),last=Date.parse(end),mid=first+Math.floor((last-first)/day/2)*day;return [[start,new Date(mid).toISOString().slice(0,10)],[new Date(mid+day).toISOString().slice(0,10),end]];}
export function pickSnapshot(rows,date,tolerance){
 if(!validDate(date))return new Map();const chosen=new Map(),target=Date.parse(date),limit=tolerance*86400000;
 for(const row of rows){const distance=Math.abs(Date.parse(row.date_prelevement.slice(0,10))-target);if(distance>limit)continue;const previous=chosen.get(row.code_station);if(!previous||distance<previous.distance||(distance===previous.distance&&row.date_prelevement<previous.row.date_prelevement))chosen.set(row.code_station,{row,distance});}
 return new Map([...chosen].map(([key,item])=>[key,item.row]));
}
export function summarize(rows){const unique=deduplicate(rows),numbers=unique.filter(quantified).map(r=>r.resultat);return {count:numbers.length,excluded:unique.length-numbers.length,mean:numbers.length?numbers.reduce((a,b)=>a+b,0)/numbers.length:null,min:numbers.length?Math.min(...numbers):null,max:numbers.length?Math.max(...numbers):null};}
export function csvCell(value,text=false){let s=String(value??'');if(text&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function concentrationColor(value,min,max){const t=max===min?.5:Math.max(0,Math.min(1,(value-min)/(max-min)));return `hsl(${215-t*30} ${45+t*20}% ${88-t*58}%)`;}
