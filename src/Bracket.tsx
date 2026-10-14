import {useEffect,useRef} from 'react';
import * as d3 from 'd3';
import type {Row,Lang} from './types';
import {score} from './analysis.mjs';
export default function Bracket({matches,lang,name,onMatch}:{matches:Row[];lang:Lang;name:(id:string)=>string;onMatch:(m:Row)=>void}){
  const ref=useRef<SVGSVGElement>(null);
  useEffect(()=>{
    if(!ref.current)return;const svg=d3.select(ref.current);svg.selectAll('*').remove();const rounds=['round_of_32','round_of_16','quarter_final','semi_final','final'];const labels=lang==='zh'?['32 强','16 强','四分之一决赛','半决赛','决赛']:['Round of 32','Round of 16','Quarter-final','Semi-final','Final'];
    const nodes:({m:Row;x:number;y:number;round:number})[]=[];const first=matches.filter(m=>m.stage===rounds.find(s=>matches.some(m=>m.stage===s)));const h=Math.max(460,first.length*78+80),w=1130;
    svg.attr('viewBox',`0 0 ${w} ${h}`);const root=svg.append('g');
    rounds.forEach((stage,r)=>{const records=matches.filter(m=>m.stage===stage).sort((a,b)=>(a.match_no||0)-(b.match_no||0));root.append('text').attr('x',20+r*222).attr('y',25).attr('class','bracket-round').text(labels[r]);records.forEach((m,i)=>{const parents=nodes.filter(n=>n.round===r-1&&n.m.winner_id&&[m.team1_id,m.team2_id].includes(n.m.winner_id));const y=parents.length?d3.mean(parents,n=>n.y)!:55+i*(h-80)/Math.max(records.length,1);nodes.push({m,x:20+r*222,y,round:r});});});
    nodes.forEach(n=>{const next=nodes.find(k=>k.round===n.round+1&&n.m.winner_id&&[k.m.team1_id,k.m.team2_id].includes(n.m.winner_id));if(next)root.append('path').attr('d',`M${n.x+184},${n.y+26}H${n.x+203}V${next.y+26}H${next.x}`).attr('stroke','#b1c4a7').attr('stroke-width',1.5).attr('fill','none');});
    nodes.forEach(n=>{const card=root.append('g').attr('transform',`translate(${n.x},${n.y})`).attr('tabindex',0).attr('role','button').attr('aria-label',`${name(n.m.team1_id)} ${score(n.m).join('–')} ${name(n.m.team2_id)}`).style('cursor','pointer').on('click',()=>onMatch(n.m)).on('keydown',e=>{if(e.key==='Enter')onMatch(n.m);});card.append('rect').attr('width',184).attr('height',54).attr('rx',6).attr('class','bracket-card');[n.m.team1_id,n.m.team2_id].forEach((id,i)=>{card.append('text').attr('x',11).attr('y',i?41:20).attr('class',n.m.winner_id===id?'bracket-team winner-text':'bracket-team').text(name(id));card.append('text').attr('x',171).attr('y',i?41:20).attr('text-anchor','end').attr('class','bracket-team').text(score(n.m)[i]);});card.append('line').attr('x1',7).attr('x2',177).attr('y1',27).attr('y2',27).attr('stroke','#dfe7d7');});
    svg.call(d3.zoom<SVGSVGElement,unknown>().scaleExtent([.5,2.5]).on('zoom',e=>root.attr('transform',e.transform))).on('dblclick.zoom',null);
  },[matches,lang,name,onMatch]);
  return <div className="bracket-wrap"><svg ref={ref} className="bracket-svg" role="img" aria-label={lang==='zh'?'真实淘汰赛晋级关系图':'Source-grounded knockout bracket'}/></div>;
}
