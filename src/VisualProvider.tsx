import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {Bundle,Row} from './types';
import {compileVisualAnalysis,scopeKey,normalizeScope} from './visualAnalysis.mjs';
import {usePandas} from './usePandas';
export type VisualScope={team:string;group:string;start:string;end:string;stage:string;final:boolean;window:number};
export type VisualResult={scope:VisualScope;summary:Row;teams:Row[];rank_shift:Row[];timing:Row[];events:Row[];heatmap:Row[];trend:Row[];daily:Row[];matches:Row[]};
type State={data:VisualResult|null;scope:VisualScope;mode:string;busy:boolean;status:string;error:string;elapsed:number;code:string;retry:()=>void;recalculate:()=>void;cancel:()=>void};
const Context=createContext<State|null>(null);
export const useVisual=()=>{const ctx=useContext(Context);if(!ctx)throw new Error('VisualProvider missing');return ctx;};
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export default function VisualProvider({bundle,scope,children}:{bundle:Bundle;scope:VisualScope;children:ReactNode}){
  const pandas=usePandas();const runRef=useRef(pandas.run);runRef.current=pandas.run;
  const [cache,setCache]=useState<Row|null>(null),[cacheReady,setCacheReady]=useState(false),[record,setRecord]=useState<{key:string;data:VisualResult;mode:string;elapsed:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[attempt,setAttempt]=useState(0);
  const key=scopeKey(scope);const normalized=normalizeScope(scope);const code=compileVisualAnalysis(scope);const generation=useRef(0);const memory=useRef(new Map<string,VisualResult>());const sourceHash=useRef('');const forceLive=useRef(false);
  useEffect(()=>{let alive=true;setCacheReady(false);setCache(null);setRecord(null);memory.current.clear();
    const tables=Object.fromEntries(['matches','team_matches','goals','teams','venues'].map(k=>[k,bundle.tables[k]]));
    (async()=>{sourceHash.current=await digest(JSON.stringify(tables));const path=bundle.manifest.complete_tournament?'data/2026/full/visual_analysis.json':'data/2026/visual_analysis.json';try{const res=await fetch(import.meta.env.BASE_URL+path);if(res.ok){const candidate=await res.json();if(alive&&candidate.engine==='pandas'&&candidate.source_sha256===sourceHash.current)setCache(candidate);}}catch{/* worker remains available */}finally{if(alive)setCacheReady(true);}})();
    return()=>{alive=false;generation.current++;};
  },[bundle.tables,bundle.manifest.complete_tournament]);
  useEffect(()=>{if(!cacheReady)return;let alive=true;const version=++generation.current;setBusy(true);setError('');
    (async()=>{try{
      const force=forceLive.current;forceLive.current=false;let payload=force?undefined:memory.current.get(key);let mode=payload?'memory':'live',elapsed=0;
      if(!payload){const candidate=force?undefined:cache?.variants?.[key];if(candidate&&candidate.code_sha256===await digest(code)){payload=candidate.payload;mode='precomputed';}else{const response=await runRef.current(code,bundle.tables);payload=response.rows[0] as VisualResult;elapsed=response.elapsed;}}
      if(alive&&version===generation.current){memory.current.set(key,payload!);setRecord({key,data:payload!,mode,elapsed});setBusy(false);}
    }catch(e){if(alive&&version===generation.current){setError(String(e));setBusy(false);}}})();
    return()=>{alive=false;};
  },[key,cache,cacheReady,attempt,bundle.tables,code]);
  const cancel=()=>{generation.current++;pandas.cancel();setBusy(false);setError('cancelled');};
  const waiting=busy||(!error&&record?.key!==key);
  return <Context.Provider value={{data:waiting||error?null:record?.key===key?record.data:null,scope:normalized,mode:record?.key===key?record.mode:'',busy:waiting,status:pandas.status,error,elapsed:record?.elapsed||0,code,retry:()=>setAttempt(x=>x+1),recalculate:()=>{forceLive.current=true;setAttempt(x=>x+1);},cancel}}>{children}</Context.Provider>;
}
