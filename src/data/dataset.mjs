// Import is a local, reversible preview. Business statistics are computed in pandas.
export function parseCSV(text, delimiter='', nullTokens=['','NA','null']) {
  text=text.replace(/^\uFEFF/,'');
  if(!text.trim())throw new Error('EMPTY_FILE');
  if(!delimiter){const line=text.split(/\r?\n/)[0];delimiter=[',',';','\t','|'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];}
  if(![',',';','\t','|'].includes(delimiter))throw new Error('DELIMITER');
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw new Error('CSV_QUOTES');}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))records.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV_QUOTES');row.push(cell);if(row.some(v=>v!==''))records.push(row);
  const columns=(records.shift()||[]).map(s=>s.trim());
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
  const candidates=Object.keys(tables).filter(k=>k!==source);const suitable=candidates.find(k=>k==='matches'&&keys.some(f=>Object.keys(tables[k]?.[0]||{}).includes(f)))||candidates.find(k=>keys.some(f=>Object.keys(tables[k]?.[0]||{}).includes(f)));const right=suitable||candidates[0]||'';
  const common=keys.find(k=>k!=='__wcl_id'&&Object.keys(tables[right]?.[0]||{}).includes(k))||keys[0]||'';
  return {source,types,registry:{},worldcupContext:['matches','team_matches','goals','teams','venues'].includes(source),field:keys.includes('attendance')?'attendance':keys[0]||'',clean:[],duplicateKeys:[],keep:'first',pixelPage:0,x:world?'total_goals':nums[0]||dims[0]||'',y:world?'goal_margin':nums[1]||nums[0]||'',color:keys.includes('stage')?'stage':dims[0]||'',date,bins:5,conditions:[],logic:'and',selectedIds:[],sort:world?'total_goals':nums[0]||keys[0]||'',ascending:false,top:10,final:true,row:team?'team_id':dims[0]||keys[0]||'',column:keys.includes('stage')?'stage':dims[1]||'',value:team?'goals_for_final':nums[0]||keys[0]||'',func:nums.length?'mean':'count',window:3,focus:'',frequency:'W',right,leftKey:common,rightKey:common,how:'left',validate:'many_to_one',relationMode:suitable?'merge':'melt',matchId:'',valueVars:world?['ft1','ft2']:nums.slice(0,3),idVars:keys.includes('match_id')?['match_id']:keys.slice(0,1),axis:0,join:'outer'};
}
export function actionToOperation(type,params,source){return {id:crypto.randomUUID(),type,params,source,created_at:new Date().toISOString()};}
export function safeJSONRows(input){const rows=Array.isArray(input)?input:input?.rows;if(!Array.isArray(rows)||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('JSON_ROWS');if(rows.some(r=>Object.keys(r).some(k=>k.startsWith('__wcl_'))))throw new Error('RESERVED_COLUMN');return rows;}
