// Import is a local, reversible preview. Business statistics are computed in pandas.
export function parseCSV(text, delimiter='', nullTokens=['','NA','null'],header=true) {
  text=text.replace(/^\uFEFF/,'');
  if(!text.trim())throw new Error('EMPTY_FILE');
  if(!delimiter){const line=text.split(/\r?\n/)[0];delimiter=[',',';','\t','|'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];}
  if(![',',';','\t','|'].includes(delimiter))throw new Error('DELIMITER');
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw new Error('CSV_QUOTES');}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))records.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV_QUOTES');row.push(cell);if(row.some(v=>v!==''))records.push(row);
  const columns=header?(records.shift()||[]).map(s=>s.trim()):Array.from({length:records[0]?.length||0},(_,i)=>'column_'+(i+1));
  if(!columns.length||columns.some(s=>!s)||new Set(columns).size!==columns.length)throw new Error('COLUMN_NAMES');
  if(columns.some(s=>s.startsWith('__wcl_')))throw new Error('RESERVED_COLUMN');
  if(records.some(r=>r.length!==columns.length))throw new Error('CSV_WIDTH');
  const raw=records.map(r=>Object.fromEntries(columns.map((k,i)=>[k,nullTokens.includes(r[i])?null:r[i]])));
  const types=Object.fromEntries(columns.map(k=>{const v=raw.map(r=>r[k]).filter(v=>v!==null);return[k,v.length&&v.every(s=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))&&!v.some(s=>/^0\d/.test(s))?'number':v.length&&v.every(s=>/^(true|false)$/i.test(s))?'boolean':v.length&&v.every(s=>/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(s))?'date':'text'];}));
  return {raw,columns,types,delimiter};
}
export function convertRows(rows,types){return rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v===null||v===undefined?null:types[k]==='number'?(Number.isFinite(Number(v))?Number(v):null):types[k]==='boolean'?(String(v).toLowerCase()==='true'?true:String(v).toLowerCase()==='false'?false:null):v])));}
export function inspectFields(rows,overrides={}){const cols=[...new Set(rows.flatMap(Object.keys))];return cols.map(key=>{const non=rows.map(r=>r[key]).filter(v=>v!=null&&v!=='');const type=non.length&&non.every(v=>typeof v==='number')?'number':non.length&&non.every(v=>typeof v==='boolean')?'boolean':non.length&&non.every(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))?'date':'text';return {key,type:overrides[key]||type};});}
export const CHAPTERS=['quality','explore','teamsChapter','relations'];
export function defaultConfig(chapter,source,tables,types={}){
  const fields=inspectFields(tables[source]||[],types),keys=fields.map(f=>f.key),nums=fields.filter(f=>f.type==='number').map(f=>f.key),dims=fields.filter(f=>f.type==='text'||f.type==='boolean').map(f=>f.key),date=fields.find(f=>f.type==='date')?.key||'';
  const world=source==='matches'&&keys.includes('ft1')&&keys.includes('ft2');
  const team=source==='team_matches'&&keys.includes('team_id');
  const football=['matches','team_matches','goals','teams','venues'];const candidates=Object.keys(tables).filter(k=>k!==source&&(football.includes(source)||!football.includes(k)));const suitable=candidates.find(k=>k==='matches'&&keys.some(f=>Object.keys(tables[k]?.[0]||{}).includes(f)))||candidates.find(k=>keys.some(f=>Object.keys(tables[k]?.[0]||{}).includes(f)));const right=suitable||candidates[0]||'';
  const common=keys.find(k=>k!=='__wcl_id'&&Object.keys(tables[right]?.[0]||{}).includes(k))||keys[0]||'';
  return {source,types,dateFormats:{},scopeFilter:{},registry:{},worldcupContext:['matches','team_matches','goals','teams','venues'].includes(source),field:keys.includes('attendance')?'attendance':keys[0]||'',clean:[],duplicateKeys:[],keep:'first',pixelPage:0,x:world?'total_goals':nums[0]||dims[0]||'',y:world?'goal_margin':nums[1]||nums[0]||'',color:keys.includes('stage')?'stage':dims[0]||'',date,bins:5,conditions:[],logic:'and',selectedIds:[],sort:world?'total_goals':nums[0]||keys[0]||'',ascending:false,top:10,final:true,row:team?'team_id':dims[0]||keys[0]||'',column:keys.includes('stage')?'stage':dims[1]||'',value:team?'goals_for_final':nums[0]||keys[0]||'',func:nums.length?'mean':'count',window:3,focus:'',frequency:'W',right,leftKey:common,rightKey:common,how:'left',validate:'many_to_one',relationMode:suitable?'merge':'melt',matchId:'',valueVars:world?['ft1','ft2']:nums.slice(0,3),idVars:keys.includes('match_id')?['match_id']:keys.slice(0,1),axis:0,join:'outer'};
}
export function actionToOperation(type,params,source){return {id:crypto.randomUUID(),type,params,source,created_at:new Date().toISOString()};}
export function safeJSONRows(input){const rows=Array.isArray(input)?input:input?.rows;if(!Array.isArray(rows)||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('JSON_ROWS');if(rows.some(r=>Object.keys(r).some(k=>k.startsWith('__wcl_'))))throw new Error('RESERVED_COLUMN');if(rows.some(r=>Object.values(r).some(v=>v!==null&&typeof v==='object')))throw new Error('JSON_NESTED');return rows;}

export function sheetRows(matrix,header=true){
  const data=matrix.filter(row=>row.some(value=>value!=null));
  if(!data.length)throw new Error('EMPTY_FILE');
  const width=Math.max(...data.map(row=>row.length));
  const columns=header?data[0].map(value=>String(value??'').trim()):Array.from({length:width},(_,i)=>'column_'+(i+1));
  if(columns.length!==width||columns.some(k=>!k)||new Set(columns).size!==columns.length)throw new Error('COLUMN_NAMES');
  if(columns.some(k=>k.startsWith('__wcl_')))throw new Error('RESERVED_COLUMN');
  return data.slice(header?1:0).map(row=>Object.fromEntries(columns.map((key,i)=>[key,row[i] instanceof Date?row[i].toISOString():row[i]??null])));
}

export function jsonTables(input){
 if(input?.project_schema_version)throw new Error('PROJECT_FILE');
 if(Array.isArray(input)||Array.isArray(input?.rows))return {Data:safeJSONRows(input)};
 const object=input?.tables||input;
 if(!object||typeof object!=='object')throw new Error('JSON_ROWS');
 const candidates=Object.entries(object).filter(([,value])=>Array.isArray(value)||Array.isArray(value?.rows));
 if(!candidates.length)throw new Error('JSON_ROWS');
 return Object.fromEntries(candidates.map(([name,value])=>[name,safeJSONRows(value)]));
}
export function importTables(current,items,{datasetId,datasetName,mode='copy',file=''}){
 const tables={...current.tables},dictionary={...current.dictionary,userTypes:{...current.dictionary.userTypes},dateFormats:{...current.dictionary.dateFormats},datasets:{...current.dictionary.datasets}};
 const existing=dictionary.datasets[datasetId];let id=datasetId||'upload_'+crypto.randomUUID();
 if(id==='worldcup')throw new Error('BUILTIN_READONLY');
 const members=[...(existing?.tables||[])];const added=[];
 for(const item of items){
  const same=members.find(k=>dictionary.datasets[id]?.labels?.[k]===item.name||k===item.name);
  let key=mode==='replace'&&same?same:['__proto__','constructor','prototype',...['matches','team_matches','goals','teams','venues']].includes(item.name)?'user_'+item.name:item.name;let suffix=2;
  if(!(mode==='replace'&&same))while(Object.hasOwn(tables,key))key=item.name+'_'+suffix++;
  tables[key]=item.rows;dictionary.userTypes[key]=item.types;dictionary.dateFormats[key]=item.dateFormats||{};
  if(!members.includes(key))members.push(key);added.push({key,name:item.name});
 }
 dictionary.datasets[id]={id,name:datasetName||existing?.name||'Dataset',origin:'upload',tables:members,labels:{...existing?.labels,...Object.fromEntries(added.map(r=>[r.key,r.name]))},revisions:(existing?.revisions||0)+1,file};
 return {tables,dictionary,datasetId:id,activeTable:added[0]?.key,replaced:mode==='replace'?added.filter(r=>existing?.tables.includes(r.key)).map(r=>r.key):[]};
}
