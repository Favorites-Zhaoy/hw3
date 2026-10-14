import {useEffect,useRef,useState} from 'react';
import type {Row} from './types';
export function usePandas(){
  const worker=useRef<Worker|null>(null);const pending=useRef(new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>());const sequence=useRef(0);const [status,setStatus]=useState('idle');
  const cancel=()=>{worker.current?.terminate();worker.current=null;for(const p of pending.current.values()){clearTimeout(p.timer);p.reject(new Error('Cancelled'));}pending.current.clear();setStatus('idle');};
  useEffect(()=>()=>{worker.current?.terminate();for(const p of pending.current.values()){clearTimeout(p.timer);p.reject(new Error('Cancelled'));}pending.current.clear();},[]);
  function run(code:string,tables:Record<string,Row[]>):Promise<{rows:Row[];elapsed:number}>{
    if(!worker.current){worker.current=new Worker(new URL('../public/pandas-worker.js',import.meta.url),{type:'module'});
      worker.current.onmessage=({data})=>{if(data.status){setStatus(data.status);return;}const p=pending.current.get(data.id);if(!p)return;clearTimeout(p.timer);pending.current.delete(data.id);if(data.error){setStatus('error');p.reject(new Error(data.error));}else{setStatus('ready');p.resolve(data);}};
      worker.current.onerror=()=>{for(const p of pending.current.values()){clearTimeout(p.timer);p.reject(new Error('Python runtime could not load. Check your connection and retry.'));}pending.current.clear();worker.current?.terminate();worker.current=null;setStatus('error');};
    }
    const id=++sequence.current;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cancel();reject(new Error('Python runtime timed out'));},150000);pending.current.set(id,{resolve,reject,timer});worker.current!.postMessage({id,code,tables});});
  }
  return {run,status,cancel};
}
