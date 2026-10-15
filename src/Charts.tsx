import {useEffect,useRef} from 'react';
import * as d3 from 'd3';
export type Datum={key:string;label:string;value:number;extra?:number};
export function Bars({data,onSelect,selected,height=275,horizontal=false,color='#438769'}:{data:Datum[];onSelect?:(key:string)=>void;selected?:string|string[];height?:number;horizontal?:boolean;color?:string}){
  const ref=useRef<SVGSVGElement>(null);
  useEffect(()=>{
    const svg=d3.select(ref.current);svg.selectAll('*').remove();const width=700;const margin={top:22,right:35,bottom:horizontal?22:50,left:horizontal?108:40};const iw=width-margin.left-margin.right,ih=height-margin.top-margin.bottom;
    const g=svg.attr('viewBox',`0 0 ${width} ${height}`).append('g').attr('transform',`translate(${margin.left},${margin.top})`);
    const band=d3.scaleBand().domain(data.map(x=>x.key)).range(horizontal?[0,ih]:[0,iw]).padding(.35);const linear=d3.scaleLinear().domain([Math.min(0,d3.min(data,x=>x.value)||0),Math.max(0,d3.max(data,x=>x.value)||0)||1]).nice().range(horizontal?[0,iw]:[ih,0]);
    const axis=g.append('g').attr('class','chart-axis').attr('transform',horizontal?'':`translate(0,${ih})`).call(horizontal?d3.axisLeft(band).tickFormat(k=>data.find(x=>x.key===k)?.label||k):d3.axisBottom(band).tickFormat(k=>data.find(x=>x.key===k)?.label||k));axis.select('.domain').remove();axis.selectAll('.tick line').remove();
    g.append('g').attr('class','chart-axis grid-axis').attr('transform',horizontal?`translate(0,${ih})`:'').call(horizontal?d3.axisBottom(linear).ticks(4).tickSize(-ih):d3.axisLeft(linear).ticks(4).tickSize(-iw)).select('.domain').remove();
    const bars=g.selectAll('rect.bar').data(data).join('rect').attr('class','bar').attr('rx',4).attr('fill',d=>(Array.isArray(selected)?selected.includes(d.key):selected===d.key)?'#ce7948':color).attr('opacity',d=>(Array.isArray(selected)?selected.length&&!selected.includes(d.key):selected&&selected!==d.key)?.35:1).attr('x',d=>horizontal?Math.min(linear(0),linear(d.value)):band(d.key)!).attr('y',d=>horizontal?band(d.key)!:Math.min(linear(0),linear(d.value))).attr('width',d=>horizontal?Math.abs(linear(d.value)-linear(0)):band.bandwidth()).attr('height',d=>horizontal?band.bandwidth():Math.abs(linear(d.value)-linear(0)));
    bars.append('title').text(d=>`${d.label}: ${d.value}`);
    if(onSelect)bars.attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.label}: ${d.value}`).style('cursor','pointer').on('click',(_,d)=>onSelect(d.key)).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(d.key);}});
    g.selectAll('text.value-label').data(data).join('text').attr('class','value-label').attr('x',d=>horizontal?linear(d.value)+8:band(d.key)!+band.bandwidth()/2).attr('y',d=>horizontal?band(d.key)!+band.bandwidth()/2+4:linear(d.value)-8).attr('text-anchor',horizontal?'start':'middle').text(d=>Number.isInteger(d.value)?d.value:d.value.toFixed(2));
  },[data,selected,horizontal,height,color,onSelect]);
  return <svg ref={ref} className="d3-chart" role="img" aria-label="Interactive bar chart"/>;
}
export function Timeline({data,onRange,range}:{data:Datum[];onRange?:(a:string,b:string)=>void;range?:[string,string]}){
  const ref=useRef<SVGSVGElement>(null);
  useEffect(()=>{
    const svg=d3.select(ref.current);svg.selectAll('*').remove();const w=700,h=190;const g=svg.attr('viewBox',`0 0 ${w} ${h}`).append('g').attr('transform','translate(35,15)');const dw=640,dh=130;
    const rows=data.map(d=>({...d,date:new Date(d.key)})).sort((a,b)=>+a.date-+b.date);if(!rows.length)return;
    const domain=d3.extent(rows,d=>d.date) as [Date,Date];if(+domain[0]===+domain[1])domain[1]=new Date(+domain[1]+86400000);
    const x=d3.scaleTime().domain(domain).range([0,dw]);const y=d3.scaleLinear().domain([Math.min(0,d3.min(rows,d=>d.value)||0),Math.max(1,d3.max(rows,d=>d.value)||1)]).nice().range([dh,0]);
    g.append('path').datum(rows).attr('fill','#438769').attr('fill-opacity',.12).attr('d',d3.area<typeof rows[number]>().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.value)).curve(d3.curveMonotoneX));
    g.append('path').datum(rows).attr('fill','none').attr('stroke','#438769').attr('stroke-width',2.5).attr('d',d3.line<typeof rows[number]>().x(d=>x(d.date)).y(d=>y(d.value)).curve(d3.curveMonotoneX));
    g.append('g').attr('class','chart-axis').attr('transform',`translate(0,${dh})`).call(d3.axisBottom(x).ticks(6).tickFormat(d=>d3.timeFormat('%m/%d')(d as Date)));g.append('g').attr('class','chart-axis').call(d3.axisLeft(y).ticks(3));
    g.selectAll('circle').data(rows).join('circle').attr('cx',d=>x(d.date)).attr('cy',d=>y(d.value)).attr('r',4).attr('fill','#438769').append('title').text(d=>`${d.key}: ${d.value}`);
    if(onRange){const brush=d3.brushX().extent([[0,0],[dw,dh]]).on('end',e=>{if(!e.sourceEvent)return;if(e.selection){onRange(d3.timeFormat('%Y-%m-%d')(x.invert(e.selection[0])),d3.timeFormat('%Y-%m-%d')(x.invert(e.selection[1])));}else onRange('','');});const layer=g.append('g').call(brush);if(range?.[0])layer.call(brush.move,[Math.max(0,x(new Date(range[0]))),Math.min(dw,x(new Date(range[1])))]);}
  },[data,onRange,range]);return <svg ref={ref} className="d3-chart" role="img" aria-label="Goal timeline with date brush"/>;
}
export function Matrix({rows,cols,values,onSelect}:{rows:{key:string;label:string}[];cols:string[];values:(number|null)[][];onSelect?:(key:string)=>void}){
  const ref=useRef<SVGSVGElement>(null);
  useEffect(()=>{const svg=d3.select(ref.current);svg.selectAll('*').remove();const h=Math.max(160,rows.length*33+45),w=700;svg.attr('viewBox',`0 0 ${w} ${h}`);const cw=(w-140)/Math.max(cols.length,1);const max=d3.max(values.flat().filter(x=>x!==null) as number[])||1;const color=d3.scaleSequential(d3.interpolateGreens).domain([0,max]);cols.forEach((c,j)=>svg.append('text').attr('x',145+j*cw+cw/2).attr('y',20).attr('text-anchor','middle').attr('class','matrix-label').text(c));rows.forEach((r,i)=>{svg.append('text').attr('x',126).attr('y',48+i*33).attr('text-anchor','end').attr('class','matrix-label').text(r.label);cols.forEach((_,j)=>{const v=values[i]?.[j]??null;const g=svg.append('g');const rect=g.append('rect').attr('x',140+j*cw).attr('y',30+i*33).attr('width',cw-5).attr('height',28).attr('rx',4).attr('fill',v===null?'#e5e6e0':color(v));g.append('text').attr('x',140+j*cw+(cw-5)/2).attr('y',48+i*33).attr('text-anchor','middle').attr('fill',v!==null&&v>max*.6?'white':'#254c3d').attr('font-size',12).text(v===null?'—':v.toFixed(v%1?2:0));if(onSelect)rect.style('cursor','pointer').attr('tabindex',0).attr('role','button').attr('aria-label',`${r.label}, ${cols[j]}, ${v??'—'}`).on('click',()=>onSelect(r.key)).on('keydown',e=>{if(e.key==='Enter')onSelect(r.key);});});});},[rows,cols,values,onSelect]);return <svg ref={ref} className="d3-chart" role="img" aria-label="Group goal matrix"/>;
}
