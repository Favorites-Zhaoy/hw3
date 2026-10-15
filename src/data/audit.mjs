// Structural checks are deliberately independent of the narrative/pandas engine.
export function auditTables(tables) {
  const errors=[],counts={},missing={},keys={matches:'match_id',teams:'team_id',venues:'venue_id',goals:'event_id'};
  const check=(ok,code,detail)=>{if(!ok)errors.push({code,detail});};
  for(const table of ['matches','team_matches','goals','teams','venues']) {
    const rows=tables[table]||[]; counts[table]=rows.length;check(rows.length>0,'TABLE_EMPTY',table);
    const fields=[...new Set(rows.flatMap(Object.keys))];
    missing[table]=Object.fromEntries(fields.map(k=>[k,rows.filter(r=>r[k]==null).length]));
    const key=keys[table];if(key)check(rows.every(r=>typeof r[key]==='string'&&r[key])&&new Set(rows.map(r=>r[key])).size===rows.length,'PRIMARY_KEY',table+'.'+key);
  }
  const matches=tables.matches||[],goals=tables.goals||[],views=tables.team_matches||[];
  const teams=new Set((tables.teams||[]).map(r=>r.team_id)),venues=new Set((tables.venues||[]).map(r=>r.venue_id));
  const byId=new Map(matches.map(m=>[m.match_id,m]));
  const logical=new Set();const stages=new Set(['group','round_of_32','round_of_16','quarter_final','semi_final','match_for_third_place','final']);
  for(const m of matches){
    const id=m.match_id;check(teams.has(m.team1_id)&&teams.has(m.team2_id)&&m.team1_id!==m.team2_id,'TEAM_FK',id);
    check(venues.has(m.venue_id),'VENUE_FK',id);
    check(/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&!Number.isNaN(Date.parse(m.date)),'DATE',id);check(stages.has(m.stage),'STAGE',id);
    const logicalKey=[m.date,...[m.team1_id,m.team2_id].sort()].join('|');check(!logical.has(logicalKey),'LOGICAL_DUPLICATE',id);logical.add(logicalKey);
    check(['ft1','ft2'].every(k=>Number.isInteger(m[k])&&m[k]>=0),'SCORE',id);
    for(const pair of [['et1','et2'],['penalties1','penalties2']])check(pair.every(k=>m[k]==null)||pair.every(k=>Number.isInteger(m[k])&&m[k]>=0),'SCORE_PAIR',id+':'+pair[0]);
    if(m.et1!=null)check(m.ft1===m.ft2&&m.et1>=m.ft1&&m.et2>=m.ft2,'EXTRA_TIME',id);
    const score=[m.et1??m.ft1,m.et2??m.ft2];
    if(m.penalties1!=null)check(m.et1!=null&&score[0]===score[1]&&m.penalties1!==m.penalties2,'SHOOTOUT',id);
    const expectedWinner=score[0]!==score[1]?(score[0]>score[1]?m.team1_id:m.team2_id):m.penalties1!=null?(m.penalties1>m.penalties2?m.team1_id:m.team2_id):null;
    check(m.winner_id===expectedWinner,'WINNER',id);
    const tm=views.filter(r=>r.match_id===id);check(tm.length===2&&new Set(tm.map(r=>r.team_id)).size===2&&tm.some(r=>r.team_id===m.team1_id&&r.side===1)&&tm.some(r=>r.team_id===m.team2_id&&r.side===2),'TEAM_VIEWS',id);
    for(const r of tm){const i=r.team_id===m.team1_id?0:1;check(r.opponent_id===m[i?'team1_id':'team2_id']&&r.goals_for_final===score[i]&&r.goals_against_final===score[1-i]&&r.goals_for_90===m[i?'ft2':'ft1']&&r.goals_against_90===m[i?'ft1':'ft2'],'TEAM_VIEW_SCORE',id+':'+r.team_id);}
    const events=goals.filter(g=>g.match_id===id);for(const [i,team] of [m.team1_id,m.team2_id].entries()){
      check(events.filter(g=>g.scoring_team_id===team).length===score[i],'EVENT_SCORE',id+':'+team);
      check(events.filter(g=>g.scoring_team_id===team&&g.minute_base<=90).length===m[i?'ft2':'ft1'],'EVENT_90_SCORE',id+':'+team);
    }
  }
  for(const r of views)check(byId.has(r.match_id)&&teams.has(r.team_id)&&teams.has(r.opponent_id),'VIEW_FK',r.match_id);
  for(const g of goals){const m=byId.get(g.match_id);check(!!m,'EVENT_FK',g.event_id);if(!m)continue;
    check([m.team1_id,m.team2_id].includes(g.scoring_team_id)&&[m.team1_id,m.team2_id].includes(g.player_team_id),'EVENT_TEAM',g.event_id);
    check(g.event_type==='goal','EVENT_TYPE',g.event_id);
    check(g.is_own_goal?g.player_team_id!==g.scoring_team_id:g.player_team_id===g.scoring_team_id,'OWN_GOAL_CREDIT',g.event_id);
    const parts=/^(\d+)(?:\+(\d+))?$/.exec(String(g.minute_label));const raw=parts?Number(parts[1]):NaN;const added=parts?Number(parts[2]||0):NaN;
    const base=!parts?.[2]&&raw>90&&m.et1==null?90:raw;const extra=base===90&&raw>90?raw-90:added;
    check(Number.isInteger(g.minute_base)&&g.minute_base>=0&&g.minute_base<=120&&Number.isInteger(g.minute_added)&&g.minute_added>=0&&g.minute_base===base&&g.minute_added===extra,'EVENT_TIME',g.event_id);
    check(g.minute_base<=90||m.et1!=null,'EVENT_EXTRA_TIME',g.event_id);
  }
  return {version:1,passed:errors.length===0,counts,missing,primary_keys:{...keys,team_matches:['match_id','team_id']},errors,source_type:'public_community',independently_verified_full_tournament:false};
}
