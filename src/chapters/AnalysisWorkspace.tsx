import {useState,useRef,useEffect,type SetStateAction} from 'react';
import {ArrowDownToLine,Undo2,Redo2,RotateCcw,Play,Code2} from 'lucide-react';
import type {Bundle,Lang,Row} from '../types';
import {defaultConfig,inspectFields,actionToOperation} from '../data/dataset.mjs';
import {tr} from '../i18n/chapters';
import {download} from '../Studio';
import Table from '../Table';
import {useChapterAnalysis} from './useChapterAnalysis';
import {ChapterControls,ChapterBody} from './ChapterViews';
import ReaderChapter from './ReaderChapter';
import {read} from '../i18n/reader';
import {stageText} from '../VisualCharts';
const chapterNo:Record<string,string>={quality:'01',explore:'02',teamsChapter:'03',relations:'04'};
const methods:Record<string,string>={quality:'info · describe · isna · duplicated · fillna · astype',explore:'loc · query · isin · between · sort_values · cut · qcut',teamsChapter:'groupby · agg · transform · pivot_table · rank · rolling · resample',relations:'merge · join · concat · melt · stack · unstack'};
export default function AnalysisWorkspace({chapter,bundle,lang,dataset,state,setState,name,onNavigate,onRecipe}:{chapter:string;bundle:Bundle;lang:Lang;dataset:string;state:Row;setState:(s:SetStateAction<Row>)=>void;name:(s:string)=>string;onNavigate:(s:string)=>void;onRecipe:(r:Row)=>void}){
 const t=(k:string,p:Record<string,unknown>={})=>tr(lang,k,p);const key=dataset+'|'+chapter;
 const defaultSource=dataset==='worldcup'?(chapter==='teamsChapter'?'team_matches':chapter==='relations'?'goals':'matches'):dataset;
 const defaults=(source:string)=>defaultConfig(chapter,source,bundle.tables,bundle.dictionary.userTypes?.[source]||{});
 const stored=state.configs?.[key]||defaults(defaultSource);const source=bundle.tables[stored.source]?stored.source:defaultSource;
 const registry=Object.fromEntries([...new Set([...Object.keys(bundle.dictionary.userTypes||{}),...Object.keys(state.preparations||{})])].map(table=>[table,{types:bundle.dictionary.userTypes?.[table]||{},clean:state.preparations?.[table]||[]}]));
 const cfg={...defaults(source),...stored,source,types:bundle.dictionary.userTypes?.[source]||{},registry,clean:state.preparations?.[source]||[],...(state.context||{})};
 const [draft,setDraftState]=useState<Row>({}),[selection,setSelection]=useState<string[]>([]),[drawer,setDrawer]=useState('current'),[open,setOpen]=useState(false),[copied,setCopied]=useState(false);const previous=useRef(key+source);const draftRef=useRef<Row>({});
 const setDraft=(next:SetStateAction<Row>)=>{draftRef.current=typeof next==='function'?next(draftRef.current):next;setDraftState(draftRef.current);};
 if(previous.current!==key+source){previous.current=key+source;setDraft({});setSelection(state.highlights?.[key]||[]);}
 const [compact,setCompact]=useState(()=>matchMedia('(max-width:760px)').matches),[controlsOpen,setControlsOpen]=useState(false);
 useEffect(()=>{const query=matchMedia('(max-width:760px)');const changed=()=>setCompact(query.matches);query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);},[]);
 const liveCfg={...cfg,...draft};const result=useChapterAnalysis(chapter,cfg,bundle),data=result.data;const fields=inspectFields(bundle.tables[source]||[],bundle.dictionary.userTypes?.[source]||{});const world=dataset==='worldcup';
 const snapshot=()=>({configs:state.configs||{},preparations:state.preparations||{},context:state.context||{},operations:state.operations||[]});
 function commit(patch:Row,label='parameters',extra:Row={}){if(['parameters','join-ports'].includes(label))patch=draftRef.current;const nextCfg={...cfg,...patch,clean:extra.preparations?.[patch.source||source]||state.preparations?.[patch.source||source]||[]};delete nextCfg.matchIds;delete nextCfg.teamIds;setState({...state,...extra,configs:{...state.configs,[key]:nextCfg},operations:[...(state.operations||[]),{...actionToOperation('chapter_analysis',{chapter,config:nextCfg},source),label}],past:[...(state.past||[]),snapshot()].slice(-50),future:[]});setDraft({});}
 const highlight=(ids:string[])=>{setSelection(ids);setState(current=>({...current,highlights:{...current.highlights,[key]:ids}}));};
 const select=(id:string,multi=false)=>highlight(multi?[...new Set([...selection,id])]:selection.includes(id)&&selection.length===1?[]:[id]);
 function history(direction:'past'|'future'){const stack=state[direction]||[];if(!stack.length)return;const other=direction==='past'?'future':'past';setState({...state,...stack.at(-1),[direction]:stack.slice(0,-1),[other]:[...(state[other]||[]),snapshot()]});setDraft({});setSelection([]);}
 const rows=(data?.rows||[]) as Row[];const evidence=chapter==='teamsChapter'?data?.charts.basis||[]:rows;
 const picked=evidence.filter((r:Row)=>selection.includes(chapter==='teamsChapter'?String(r[cfg.row]):r.__wcl_id));
 function carry(target:string,ids=selection){const selected=evidence.filter((r:Row)=>ids.includes(chapter==='teamsChapter'?String(r[cfg.row]):r.__wcl_id));const matchIds=selected.map((r:Row)=>r.match_id).filter(Boolean);setState({...state,context:{matchIds:[...new Set(matchIds)],teamIds:chapter==='teamsChapter'?ids:[]}});onNavigate(target);}
 const exportPy=()=>download('reproduce-analysis.py',`# World Cup Data Lab / Visual Pandas 3\n# Source data are embedded for reproducibility.\n_tables_json = ${JSON.stringify(JSON.stringify(bundle.tables))}\n${result.code}\nprint(_result)\n`,'text/x-python');
 function csvExport(){const cols=data?.columns||[];const esc=(s:unknown)=>'"'+String(s??'').replaceAll('"','""')+'"';download(source+'-result.csv','\uFEFF'+[cols.map(esc).join(','),...rows.map(r=>cols.map((c:string)=>esc(r[c])).join(','))].join('\r\n'),'text/csv');}
 function insight(){if(!data)return result.busy?t('loading'):t('error');const c=data.charts;if(chapter==='quality'){const f=c.profile.find((r:Row)=>r.field===cfg.field);return f?`${cfg.field}: ${f.valid} ${t('valid')} / ${f.missing} ${t('missing')} / ${f.invalid} ${t('invalid')} · ${Number(f.complete).toFixed(1)}% · ${c.duplicateRows} ${lang==='zh'?'条重复记录':'duplicate records'}`:`${data.outputRows} ${t('rows')}`;}
  if(chapter==='explore')return `${data.inputRows} → ${data.outputRows} ${t('rows')} · ${cfg.x} / ${cfg.y} · qcut ${c.actualBins}/${c.requestedBins}`;
  if(chapter==='teamsChapter'){const top=c.groups[0];return `${data.inputRows} → ${data.outputRows} ${lang==='zh'?'个分组':'groups'} · ${top?name(top.team_id)+' / '+t('sum')+' '+(top.total==null?'—':Number(top.total).toFixed(2)):t('noRows')}`;}
  return `${source} ⋈ ${cfg.right}: ${data.outputRows} ${t('rows')} · ${c.flow.map((r:Row)=>t(r.key)+' '+r.value).join(' / ')}`;
 }

 const recipeIds:Record<string,string[]>={quality:['quality'],explore:['overview','knockout'],teamsChapter:['team-path','goals-leaders','group-matrix','team-form','venue'],relations:['goal-time','match-drill','join-lab','code']};
 return <div className="chapter-workspace" onKeyDown={e=>{if(e.key==='Escape'){setSelection([]);setDraft({});}}}>
 <header className="chapter-heading"><div className="chapter-heading-number">{chapterNo[chapter]}</div><div><span className="eyebrow">WORLD CUP DATA LAB / {chapterNo[chapter]}</span><h1>{world?read(lang,chapter):t(chapter==='quality'?'quality.question':'generic.'+chapter+'.question')}</h1><p>{world?read(lang,chapter+'.sub'):t(chapter+'.subtitle')}</p></div></header>
 <div className="reader-scope"><span>{read(lang,'scope')}: {world?read(lang,'source'):dataset} · {data?.outputRows??'…'} {t('rows')}{world&&chapter!=='quality'?' · '+((chapter==='teamsChapter'?String(cfg.value).endsWith('_final'):cfg.final)?read(lang,'final'):read(lang,'ninety')):''}{state.context?.matchIds?.length?` · ${state.context.matchIds.length} ${read(lang,'matches')}`:''}{state.context?.teamIds?.length?` · ${state.context.teamIds.map(name).join(', ')}`:''}</span><button onClick={()=>{setState({...state,configs:{},preparations:{},context:{},past:[...(state.past||[]),snapshot()].slice(-50),future:[]});setDraft({});setSelection([]);}}>{read(lang,'reset')}</button></div>
 {world&&<div className="reader-scope-details">{cfg.stage&&<span>{lang==='zh'?'阶段':'Stage'}: {stageText(cfg.stage,lang)}</span>}{cfg.overviewDay&&<span>{cfg.overviewDay}</span>}{cfg.conditions?.map((cond:Row,i:number)=><span key={i}>{cond.field==='total_goals'?(lang==='zh'?'总进球':'Total goals'):cond.field==='goal_margin'?(lang==='zh'?'比分差':'Goal margin'):cond.field} {{ge:'≥',le:'≤',eq:'=',gt:'>',lt:'<'}[cond.operator as string]||cond.operator} {JSON.stringify(cond.value)}</span>)}{cfg.selectedIds?.length>0&&<span>{lang==='zh'?'仅限已应用的':'Applied selection:'} {cfg.selectedIds.length} {read(lang,'matches')}</span>}{cfg.tags?.map((tag:string)=><span key={tag}>{read(lang,tag==='__wcl_extra'?'extra':tag==='__wcl_shootout'?'shootout':'lateTag')}</span>)}</div>}
 {world&&<p className="story-caption">{read(lang,'selectNote')}</p>}
 {world&&(result.error?<div className="chapter-error" role="alert">{read(lang,'error')}<button onClick={result.run}>{read(lang,'retry')}</button></div>:result.busy?<div className="chapter-loading" role="status"><span className="computing-ring"/><p>{read(lang,'loading')}</p><button onClick={result.cancel}>{t('cancel')}</button></div>:data&&<ReaderChapter key={key} {...{chapter,data,lang,name,selection,select,highlight,commit,bundle,carry}} config={cfg}/>)}
 <div className="chapter-toolbar history-toolbar"><button disabled={!state.past?.length} onClick={()=>history('past')}><Undo2 size={14}/>{t('undo')}</button><button disabled={!state.future?.length} onClick={()=>history('future')}><Redo2 size={14}/>{t('redo')}</button><button onClick={()=>{commit(defaults(source),'reset',{preparations:{...state.preparations,[source]:[]},context:{}});setSelection([]);}}><RotateCcw size={13}/>{t('reset')}</button><span>{t('selectedN',{n:selection.length,total:chapter==='teamsChapter'?data?.outputRows??0:evidence.length})}</span><button disabled={!selection.length} onClick={()=>highlight([])}>{t('clear')}</button>{chapter!=='quality'&&state.context?.matchIds?.length>0&&<button onClick={()=>setState({...state,context:{}})}>{t('matchScope',{n:state.context.matchIds.length})} ×</button>}</div>
 <details className="chapter-recipes"><summary>{t('recipes')} · {t('resources')}</summary><p>{t('methodOwnership')}</p><div>{world&&bundle.recipes.filter(r=>(recipeIds[chapter]||[]).includes(r.id)).map(r=><button key={r.id} onClick={()=>onRecipe(r)}><strong>{r.title?.[lang]||r.name?.[lang]||r.id}</strong><code>{r.id}</code></button>)}<button onClick={()=>onNavigate('atlas')}>pandas Atlas ↗</button><button onClick={()=>onNavigate('data')}>{t('source')} / {t('scope')} ↗</button></div></details>
 </div>;
}
