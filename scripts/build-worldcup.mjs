import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const translations={'Mexico':'墨西哥','South Africa':'南非','South Korea':'韩国','Czech Republic':'捷克','Canada':'加拿大','Bosnia & Herzegovina':'波黑','Qatar':'卡塔尔','Switzerland':'瑞士','Brazil':'巴西','Morocco':'摩洛哥','Haiti':'海地','Scotland':'苏格兰','USA':'美国','Paraguay':'巴拉圭','Australia':'澳大利亚','Turkey':'土耳其','Germany':'德国','Curaçao':'库拉索','Ivory Coast':'科特迪瓦','Ecuador':'厄瓜多尔','Netherlands':'荷兰','Japan':'日本','Tunisia':'突尼斯','Sweden':'瑞典','Belgium':'比利时','Egypt':'埃及','Iran':'伊朗','New Zealand':'新西兰','Spain':'西班牙','Cape Verde':'佛得角','Saudi Arabia':'沙特阿拉伯','Uruguay':'乌拉圭','France':'法国','Senegal':'塞内加尔','Iraq':'伊拉克','Norway':'挪威','Argentina':'阿根廷','Algeria':'阿尔及利亚','Austria':'奥地利','Jordan':'约旦','Portugal':'葡萄牙','DR Congo':'刚果民主共和国','Uzbekistan':'乌兹别克斯坦','Colombia':'哥伦比亚','England':'英格兰','Croatia':'克罗地亚','Ghana':'加纳','Panama':'巴拿马'};
const stages={'Round of 32':'round_of_32','Round of 16':'round_of_16','Quarter-final':'quarter_final','Semi-final':'semi_final','Match for third place':'match_for_third_place','Final':'final'};
export function minuteParts(raw,hasET=false){const match=String(raw).match(/^(\d+)(?:\+(\d+))?$/);if(!match)throw new Error('Unrecognized minute: '+raw);let base=+match[1],added=+(match[2]||0);if(!hasET&&base>90&&!added){added=base-90;base=90;}return {minute_label:String(raw),minute_base:base,minute_added:added,phase:base<=45?'first_half':base<=90?'second_half':base<=105?'extra_first_half':'extra_second_half'};}
export function normalize(input){
  const raw=input.matches;if(!Array.isArray(raw)||raw.length!==104)throw new Error(`Expected exactly 104 matches, found ${raw?.length}`);
  const matches=[],team_matches=[],goals=[],teams=new Map(),venues=new Map();
  for(const m of raw){
    if(!m.team1||!m.team2||!m.date||!Array.isArray(m.score?.ft)||m.score.ft.some(s=>!Number.isInteger(s)||s<0))throw new Error('Incomplete match record');
    const a=slug(m.team1),b=slug(m.team2),id='m_'+createHash('sha256').update(`${m.date}|${m.team1}|${m.team2}`).digest('hex').slice(0,12);const stage=m.group?'group':stages[m.round];if(!stage)throw new Error('Unknown stage: '+m.round);
    const ft=m.score.ft,et=m.score.et||[null,null],ht=m.score.ht||[null,null],pen=m.score.p||m.score.pen||m.score.penalties||[null,null];const final=et[0]!==null?et:ft;
    let winner=final[0]>final[1]?a:final[0]<final[1]?b:null;if(!winner&&pen[0]!==null)winner=pen[0]>pen[1]?a:pen[0]<pen[1]?b:null;
    const time=String(m.time||'').match(/^(\d{2}:\d{2}) UTC([+-]\d+)/);const utc=time?new Date(Date.parse(m.date+'T'+time[1]+':00Z')-Number(time[2])*3600000).toISOString():null;
    matches.push({match_id:id,match_no:m.num??null,date:m.date,local_time:m.time??null,kickoff_utc:utc,round:m.round,stage,group:m.group??null,team1_id:a,team2_id:b,team1_name:m.team1,team2_name:m.team2,venue_id:slug(m.ground||'unknown'),venue_name:m.ground??null,status:'completed',ht1:ht[0],ht2:ht[1],ft1:ft[0],ft2:ft[1],et1:et[0],et2:et[1],penalties1:pen[0],penalties2:pen[1],winner_id:winner,attendance:null,data_level:'basic',source:'openfootball'});
    for(const [i,team_id,opponent_id,n] of [[0,a,b,m.team1],[1,b,a,m.team2]]){
      if(!teams.has(team_id)||m.group)teams.set(team_id,{team_id,name_en:n,name_zh:translations[n]||null,group:m.group??teams.get(team_id)?.group??null,label_status:translations[n]?'translated':'source_fallback'});
      team_matches.push({match_id:id,team_id,opponent_id,side:i+1,date:m.date,stage,group:m.group??null,goals_for_90:ft[i],goals_against_90:ft[1-i],goals_for_final:final[i],goals_against_final:final[1-i],win:winner===team_id,draw_90:ft[0]===ft[1],result_90:ft[i]>ft[1-i]?'W':ft[i]<ft[1-i]?'L':'D',goal_difference_90:ft[i]-ft[1-i],shots:null,shots_on_target:null,possession_pct:null,xg:null});
      const events=m['goals'+(i+1)]||[];if(events.length!==final[i])throw new Error(`Goal events do not match final score for ${id}, side ${i+1}`);
      events.forEach((g,j)=>goals.push({event_id:`${id}-g${i+1}-${j+1}`,match_id:id,event_type:'goal',scoring_team_id:team_id,player_name:g.name,player_team_id:g.owngoal?opponent_id:team_id,...minuteParts(g.minute,et[0]!==null),is_penalty:!!g.penalty,is_own_goal:!!g.owngoal,x:null,y:null,xg:null,data_level:'basic'}));
    }
    const venue_id=slug(m.ground||'unknown');venues.set(venue_id,{venue_id,name_en:m.ground??null,name_zh:null,country:null,latitude:null,longitude:null,geo_verified:false});
  }
  if(new Set(matches.map(m=>m.match_id)).size!==104)throw new Error('Duplicate matches');
  return {matches,team_matches,goals,teams:[...teams.values()].sort((a,b)=>a.team_id.localeCompare(b.team_id)),venues:[...venues.values()]};
}
async function main(){
  const args=process.argv.slice(2);const at=args.indexOf('--base');const source='https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
  const raw=at>=0?await readFile(args[at+1],'utf8'):await (async()=>{const r=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Source HTTP ${r.status}`);return r.text();})();
  const tables=normalize(JSON.parse(raw));const out=path.resolve('public/data/2026/full');const now=new Date().toISOString();const localDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Singapore'}).format(new Date());await mkdir(out,{recursive:true});
  const counts=Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]));const hashes={};
  for(const [table,rows] of Object.entries(tables)){const payload=JSON.stringify({schema_version:'1.0.0',dataset_id:'fifa-world-cup-2026-full',table,meta:{source,snapshot_date:localDate,scope:'complete_tournament',row_count:rows.length},rows},null,2);hashes[table]=createHash('sha256').update(payload).digest('hex');await writeFile(path.join(out,table+'.json'),payload);}
  await writeFile(path.join(out,'sources.json'),JSON.stringify({source,fetched_at:now,source_sha256:createHash('sha256').update(raw).digest('hex'),note:'Community data, not independently FIFA-certified.'},null,2));
  // The manifest is written last; the loader only opts into a completely validated dataset.
  await writeFile(path.join(out,'manifest.json'),JSON.stringify({schema_version:'1.0.0',id:'fifa-world-cup-2026-full',complete_tournament:true,counts,sha256:hashes,snapshot_date:localDate,snapshot_timezone:'Asia/Singapore',fetched_at:now,source,source_sha256:createHash('sha256').update(raw).digest('hex'),scope:'complete_tournament',availability:{scores:true,goal_times:true,shots:false,xg:false,tracking:false,lineups:false,squads:false}},null,2));
  console.log('Verified complete static dataset:',JSON.stringify(counts));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error('Full dataset not written:',e.message);process.exitCode=1;});
