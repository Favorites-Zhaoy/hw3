import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {compileVisualAnalysis,DEFAULT_SCOPE,scopeKey} from '../src/visualAnalysis.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const names=['matches','team_matches','goals','teams','venues'];
for(const directory of ['public/data/2026/','public/data/2026/full/']){
  const tables=Object.fromEntries(await Promise.all(names.map(async k=>[k,JSON.parse(await readFile(directory+k+'.json','utf8')).rows])));
  const scopes=[];
  for(const final of [true,false]){
    for(const window of [2,3,4,5])scopes.push({...DEFAULT_SCOPE,final,window});
    for(const team of tables.teams.map(t=>t.team_id))scopes.push({...DEFAULT_SCOPE,final,team});
    for(const group of new Set(tables.matches.map(m=>m.group).filter(Boolean)))scopes.push({...DEFAULT_SCOPE,final,group});
    for(const stage of new Set(tables.matches.map(m=>m.stage)))scopes.push({...DEFAULT_SCOPE,final,stage});
  }
  const definitions=scopes.map(s=>({key:scopeKey(s),code:compileVisualAnalysis(s)}));
  const result=spawnSync(process.env.PYTHON||'python',['-c',`import sys,json,contextlib,io
request=json.load(sys.stdin)
out={}
for definition in request['definitions']:
    env={'_tables_json':json.dumps(request['tables'],ensure_ascii=False)}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(definition['code'],env)
    out[definition['key']]=json.loads(env['_result'])[0]
print(json.dumps(out,ensure_ascii=False,allow_nan=False))`],{input:JSON.stringify({tables,definitions}),encoding:'utf8',maxBuffer:30*1024*1024,env:{...process.env,PYTHONUTF8:'1'}});
  if(result.status!==0)throw new Error(result.stderr);
  const payloads=JSON.parse(result.stdout);const variants=Object.fromEntries(definitions.map(d=>[d.key,{code_sha256:hash(d.code),payload:payloads[d.key]}]));
  await writeFile(directory+'visual_analysis.json',JSON.stringify({schema_version:'2.0',engine:'pandas',generated_at:new Date().toISOString(),source_sha256:hash(JSON.stringify(tables)),variants}));
  console.log(directory,scopes.length,'real pandas precomputations; default goals:',payloads[scopeKey(DEFAULT_SCOPE)].summary.goals);
}
