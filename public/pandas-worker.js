let runtime;
let queue=Promise.resolve();
async function getRuntime(){
  if(!runtime) runtime=(async()=>{
    self.postMessage({status:'loading'});
    const {loadPyodide}=await import('https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs');
    const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'});
    self.postMessage({status:'packages'});
    await py.loadPackage('pandas');
    self.postMessage({status:'ready'});
    return py;
  })().catch(e=>{runtime=null;throw e;});
  return runtime;
}
self.onmessage=({data})=>{
  queue=queue.then(async()=>{
    const {id,code,tables}=data;
    try{
      const py=await getRuntime();
      if(!code){self.postMessage({id,ready:true});return;}
      py.globals.set('_tables_json',JSON.stringify(tables));
      const start=performance.now();
      await py.runPythonAsync(code);
      const rows=JSON.parse(py.globals.get('_result'));
      self.postMessage({id,rows,elapsed:performance.now()-start});
    }catch(e){self.postMessage({id,error:String(e.message||e)});}
  });
};
