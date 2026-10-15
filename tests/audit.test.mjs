import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditTables} from '../src/data/audit.mjs';
import {sheetRows} from '../src/data/dataset.mjs';
const read=base=>Object.fromEntries(['matches','team_matches','goals','teams','venues'].map(k=>[k,JSON.parse(readFileSync(base+k+'.json')).rows]));
const tables=read('public/data/2026/full/');
test('full and offline data pass independent integrity checks',()=>{for(const base of ['public/data/2026/full/','public/data/2026/'])assert.deepEqual(auditTables(read(base)).errors,[]);});
for(const [label,mutate,code] of [
 ['duplicate primary key',t=>t.matches.push(t.matches[0]),'PRIMARY_KEY'],
 ['orphan goal',t=>t.goals[0].match_id='missing','EVENT_FK'],
 ['wrong score',t=>t.matches[0].ft1+=1,'EVENT_SCORE'],
 ['missing team perspective',t=>t.team_matches.pop(),'TEAM_VIEWS'],
 ['wrong own-goal beneficiary',t=>{const g=t.goals.find(g=>g.is_own_goal);g.scoring_team_id=g.player_team_id;},'OWN_GOAL_CREDIT'],
 ['shootout counted as match goals',t=>{const m=t.matches.find(m=>m.penalties1!=null);m.et1+=m.penalties1;},'SHOOTOUT'],
 ['lost added-time meaning',t=>{const g=t.goals.find(g=>g.minute_added>0);g.minute_added=0;},'EVENT_TIME']
])test('audit rejects '+label,()=>{const copy=structuredClone(tables);mutate(copy);const audit=auditTables(copy);assert.equal(audit.passed,false);assert.ok(audit.errors.some(e=>e.code===code));});
test('worksheet conversion preserves zeros, missing cells, dates and headerless data',()=>{const result=sheetRows([['id','value','date'],['001',0,new Date('2026-01-01T00:00:00Z')],['002',null,null]]);assert.equal(result[0].id,'001');assert.equal(result[0].value,0);assert.equal(result[1].value,null);assert.equal(result[0].date,'2026-01-01T00:00:00.000Z');assert.deepEqual(sheetRows([[1,2],[3,4]],false),[{column_1:1,column_2:2},{column_1:3,column_2:4}]);for(const header of [['a','a'],['a',null],['__wcl_id','b']])assert.throws(()=>sheetRows([header,[1,2]]));});
