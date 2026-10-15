import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compileChapter} from '../src/data/chapterAnalysis.mjs';
import {defaultConfig,CHAPTERS} from '../src/data/dataset.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
for(const base of ['public/data/2026/','public/data/2026/full/']){
  const tables=Object.fromEntries(await Promise.all(['matches','team_matches','goals','teams','venues'].map(async k=>[k,JSON.parse(await readFile(base+k+'.json','utf8')).rows])));
  const variants={};
  for(const chapter of CHAPTERS){const source=chapter==='teamsChapter'?'team_matches':chapter==='relations'?'goals':'matches';const cfg=defaultConfig(chapter,source,tables);const code=compileChapter(chapter,cfg);const r=spawnSync(process.env.PYTHON||'python',['-c',`import sys\n_tables_json=sys.stdin.read()\n${code}\nprint(_result)`],{input:JSON.stringify(tables),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'},maxBuffer:30*1024*1024});if(r.status!==0)throw new Error(chapter+': '+r.stderr);variants[hash(code)]={payload:JSON.parse(r.stdout)[0]};console.log(base,chapter,variants[hash(code)].payload.outputRows);}
  await writeFile(base+'chapter_analysis.json',JSON.stringify({source_sha256:hash(JSON.stringify(tables)),variants}));
}
