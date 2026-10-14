// Uses the existing Git credential manager. Tokens remain in process memory.
import {spawnSync} from 'node:child_process';
const repo='Favorites-Zhaoy/hw3';
const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:30000});
if(credential.status!==0){console.error('GitHub credential is not available');process.exit(1);}
const fields=Object.fromEntries(credential.stdout.trim().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
if(!fields.password){console.error('No GitHub token returned');process.exit(1);}
async function api(route,method='GET',body){const r=await fetch('https://api.github.com/repos/'+repo+route,{method,headers:{Authorization:'Bearer '+fields.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const data=r.status===204?{}:await r.json();if(!r.ok){const e=new Error(`GitHub API ${method} ${route}: HTTP ${r.status}, ${data.message||''}`);e.status=r.status;throw e;}return data;}
try{
  const mode=process.argv[2]||'inspect';
  if(mode==='inspect'){const r=await api('');console.log(JSON.stringify({repository:r.full_name,default_branch:r.default_branch,permissions:r.permissions,has_pages:r.has_pages}));}
  if(mode==='deploy'){
    try{const p=await api('/pages');if(p.build_type!=='workflow')await api('/pages','PUT',{build_type:'workflow'});}
    catch(e){if(e.status===404)await api('/pages','POST',{build_type:'workflow'});else throw e;}
    await api('/actions/workflows/pages.yml/dispatches','POST',{ref:'main'});console.log('GitHub Pages deployment dispatched for main');
  }
  if(mode==='status'){const runs=await api('/actions/workflows/pages.yml/runs?per_page=3');const pages=await api('/pages');console.log(JSON.stringify({pages:{url:pages.html_url,status:pages.status,build_type:pages.build_type},runs:runs.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url,sha:r.head_sha,created_at:r.created_at}))}));}
  if(mode==='logs'){const runs=await api('/actions/workflows/pages.yml/runs?per_page=1');const jobs=await api(`/actions/runs/${runs.workflow_runs[0].id}/jobs`);console.log(JSON.stringify(jobs.jobs.map(j=>({name:j.name,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,conclusion:s.conclusion}))}))));}
}catch(e){console.error(e.message);process.exitCode=1;}
