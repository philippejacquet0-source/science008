import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unpackCatalogue} from '../dist/catalogue.mjs';
import {PARAMETERS} from '../dist/core.mjs';
test('Catalogue national complet par département, identifiants uniques et coordonnées exploitables',async()=>{const packed=JSON.parse(await readFile(new URL('../dist/data/stations.compact.json',import.meta.url),'utf8'));const rows=unpackCatalogue(packed);assert.equal(rows.length,packed.collectedCount-packed.withoutCoordinates);assert.equal(new Set(rows.map(s=>s.bss_id)).size,rows.length);assert.ok(rows.every(s=>Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)));assert.ok(rows.filter(s=>s.nom_nature_pe==='Forage').length>40000);assert.equal(Object.values(packed.departmentCounts).reduce((a,b)=>a+b,0),packed.collectedCount);});
test('Les paramètres de l’exemple correspondent aux codes demandés',async()=>{const data=JSON.parse(await readFile(new URL('../dist/data/examples.json',import.meta.url),'utf8'));assert.ok(data.rows.length>0);for(const row of data.rows){assert.ok(data.ids.includes(row.bss_id));assert.ok(PARAMETERS.some(p=>p.code===String(row.code_param)));}});
