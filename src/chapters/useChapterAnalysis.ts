import {useEffect,useRef,useState} from 'react';
import {usePandas} from '../usePandas';
import {compileChapter} from '../data/chapterAnalysis.mjs';
import type {Bundle,Row} from '../types';
const memory=new Map<string,Row>();
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export function useChapterAnalysis(chapter:string,config:Row,bundle:Bundle){
 const code=compileChapter(chapter,config),key=code;const worker=usePandas(),[attempt,setAttempt]=useState(0),[state,setState]=useState<{key:string;data:Row|null;busy:boolean;error:string;mode:string;elapsed:number}>({key:'',data:null,busy:true,error:'',mode:'',elapsed:0});
 const generation=useRef(0),force=useRef(false),fingerprints=useRef<{tables:Bundle['tables'];hash:Promise<string>}|null>(null),cacheFile=useRef<Promise<Row>|null>(null);
 useEffect(()=>{const id=++generation.current;let cancelled=false;const forced=force.current;force.current=false;setState({key,data:null,busy:true,error:'',mode:'',elapsed:0});
  void (async()=>{try{
   if(fingerprints.current?.tables!==bundle.tables)fingerprints.current={tables:bundle.tables,hash:digest(JSON.stringify(bundle.tables))};
   const [sourceHash,codeHash]=await Promise.all([fingerprints.current.hash,digest(code)]),cacheKey=sourceHash+codeHash;
   let data=forced?null:memory.get(cacheKey);let mode=data?'memory':'';let elapsed=0;
   if(!data&&!forced){if(!cacheFile.current){const path=bundle.manifest.complete_tournament?'data/2026/full/':'data/2026/';cacheFile.current=fetch(import.meta.env.BASE_URL+path+'chapter_analysis.json').then(r=>r.ok?r.json():null).catch(()=>null);}
    const file=await cacheFile.current;if(file?.source_sha256===sourceHash&&file.variants?.[codeHash]){data=file.variants[codeHash].payload;mode='cache';}}
   if(cancelled||id!==generation.current)return;
   if(!data){const result=await worker.run(code,bundle.tables);data=result.rows[0];mode='live';elapsed=result.elapsed;}
   if(cancelled||id!==generation.current)return;memory.set(cacheKey,data!);setState({key,data:data!,busy:false,error:'',mode,elapsed});
  }catch(e){if(!cancelled&&id===generation.current)setState({key,data:null,busy:false,error:String(e),mode:'',elapsed:0});}})();
  return()=>{cancelled=true;};
 },[code,bundle.tables,attempt]);
 const cancel=()=>{generation.current++;worker.cancel();setState({key,data:null,busy:false,error:'Cancelled',mode:'',elapsed:0});};
 const run=()=>{force.current=true;setAttempt(n=>n+1);};
 return {...state,data:state.key===key?state.data:null,busy:state.key!==key||state.busy,code,run,cancel,runtime:worker.status};
}
