import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const html=await readFile(path.join(dist,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw Error('Identifiants HTML dupliqués');
for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(/^(?:https?:|data:|#)/.test(m[1]))continue;await stat(path.join(dist,m[1]));}
const source=await readFile(path.join(dist,'app.js'),'utf8');for(const m of source.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(m[1]))throw Error('Élément HTML absent : '+m[1]);
const bundle=await readFile(path.join(dist,'app.bundle.js'),'utf8');if(/^\s*(?:import|export)\s/m.test(bundle))throw Error('Le bundle doit fonctionner en script classique');
console.log('Ressources locales, identifiants HTML et bundle statique vérifiés.');
