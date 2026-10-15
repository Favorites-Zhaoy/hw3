// One operation protocol produces the exact Python executed by the worker.
import {compileVisualAnalysis} from './visualAnalysis.mjs';
import {compileChapter} from './data/chapterAnalysis.mjs';
export {compileChapter} from './data/chapterAnalysis.mjs';
const q = v => JSON.stringify(v);
const literal = v => v === null ? 'None' : typeof v === 'boolean' ? (v ? 'True' : 'False') : q(v);
const functions = new Set(['sum','mean','count','min','max','median','std','nunique']);
export {compileVisualAnalysis,visualCodeSection,normalizeScope,scopeKey,DEFAULT_SCOPE} from './visualAnalysis.mjs';
export function compilePipeline(source, operations, tables) {
  if (!Object.hasOwn(tables,source)) throw new Error('Unknown source table');
  const code = ['import pandas as pd','import json',`tables = {k: pd.DataFrame(v) for k, v in json.loads(_tables_json).items()}`,`df = tables[${q(source)}].copy()`];
  for (const {type,params:p} of operations) {
    switch(type) {
      case 'chapter_analysis': code.push(compileChapter(p.chapter,{...p.config,source}), 'df = pd.DataFrame(json.loads(_result)[0]["rows"])');break;
      case 'filter': {
        const s=`df[${q(p.field)}]`, v=literal(p.value);
        const mask = p.operator==='contains' ? `${s}.astype(str).str.contains(${q(String(p.value))}, regex=False, na=False)` : p.operator==='notnull' ? `${s}.notna()` : p.operator==='isnull' ? `${s}.isna()` : `${s} ${({'eq':'==','ne':'!=','gt':'>','lt':'<','ge':'>=','le':'<='})[p.operator] || '=='} ${v}`;
        code.push(`df = df.loc[${mask}].copy()`); break;
      }
      case 'select': code.push(`df = df[${q(p.fields)}].copy()`); break;
      case 'sort': code.push(`df = df.sort_values(${q(p.field)}, ascending=${p.ascending?'True':'False'}, kind="stable")`);break;
      case 'head':code.push(`df = df.head(${Number(p.n)||10})`);break;
      case 'aggregate': {
        if (!functions.has(p.func)) throw new Error('Unsupported aggregation');
        code.push(`df = df.groupby(${q(p.group)}, as_index=False, dropna=False).agg(value=(${q(p.value)}, ${q(p.func)}), records=(${q(p.value)}, "size"))`);
        code.push('df = df.sort_values("value", ascending=False, kind="stable")');break;
      }
      case 'pivot': {
        if (!functions.has(p.func)) throw new Error('Unsupported aggregation');
        code.push(`df = df.pivot_table(index=${q(p.index)}, columns=${q(p.columns)}, values=${q(p.value)}, aggfunc=${q(p.func)}, fill_value=0).reset_index()`);break;
      }
      case 'merge': {
        if(!Object.hasOwn(tables,p.table)) throw new Error('Unknown join table');
        if(!['left','inner','outer'].includes(p.how)) throw new Error('Unsupported join');
        if(!['many_to_one','one_to_one','one_to_many','many_to_many'].includes(p.validate)) throw new Error('Unsupported cardinality');
        code.push(`df = df.merge(tables[${q(p.table)}], left_on=${q(p.left)}, right_on=${q(p.right)}, how=${q(p.how)}, validate=${q(p.validate)}, suffixes=("", "_joined"), indicator=True)`);break;
      }
      case 'missing':code.push('df = df.isna().mean().rename("missing_ratio").rename_axis("field").reset_index().sort_values("missing_ratio", ascending=False)');break;
      case 'deduplicate':code.push(`df = df.drop_duplicates(${p.field ? `subset=[${q(p.field)}]` : ''})`);break;
      case 'dropna':code.push(`df = df.dropna(subset=[${q(p.field)}])`);break;
      case 'fillna':code.push(`df[${q(p.field)}] = df[${q(p.field)}].fillna(${literal(p.value)})`);break;
      case 'numeric':code.push(`df[${q(p.field)}] = pd.to_numeric(df[${q(p.field)}], errors="coerce")`);break;
      case 'datetime':code.push(`df[${q(p.field)}] = pd.to_datetime(df[${q(p.field)}], errors="coerce")`);break;
      case 'strip':code.push(`df[${q(p.field)}] = df[${q(p.field)}].astype("string").str.strip()`);break;
      case 'rename':code.push(`df = df.rename(columns={${q(p.field)}: ${q(p.name)}})`);break;
      case 'rolling':code.push(`df = df.sort_values([${q(p.group)}, ${q(p.date)}], kind="stable")`,`df["rolling_mean"] = df.groupby(${q(p.group)})[${q(p.value)}].transform(lambda s: s.rolling(${Number(p.window)||3}, min_periods=1).mean())`,`df["match_index"] = df.groupby(${q(p.group)}).cumcount()+1`,`df["goals"] = df[${q(p.value)}]`,'df["rolling_goals"] = df["rolling_mean"]');break;
      case 'cut':code.push(`df["minute_band"] = pd.cut(pd.to_numeric(df[${q(p.field)}], errors="coerce"), bins=[0,15,30,45,60,75,90,105,120,150], labels=["01–15","16–30","31–45","46–60","61–75","76–90","91–105","106–120","121+"], include_lowest=True).astype("string")`);break;
      case 'melt':code.push(`df = df.melt(id_vars=[${q(p.group)}], value_vars=${q(p.fields)}, var_name="metric", value_name="value")`);break;
      case 'describe':code.push('df = df.describe(include="all").rename_axis("statistic").reset_index()');break;
      case 'total':code.push('df["total_goals"] = df["et1"].fillna(df["ft1"]) + df["et2"].fillna(df["ft2"])');break;
      case 'custom':code.push(p.code);break;
      case 'visual_teams':code.push(compileVisualAnalysis(p.scope||{}),'df = teams.copy()');break;
      case 'visual_form':code.push(compileVisualAnalysis(p.scope||{}),`df = trend.loc[trend["team_id"].eq(${q(p.team||'spain')})].copy()`);break;
      case 'visual_timing':code.push(compileVisualAnalysis(p.scope||{}),'df = timing.copy()');break;
      case 'visual_heatmap':code.push(compileVisualAnalysis(p.scope||{}),'df = counts.reset_index()');break;
      default:throw new Error('Unsupported operation: '+type);
    }
  }
  code.push('if not isinstance(df, pd.DataFrame):\n    raise ValueError("The result must be a DataFrame named df")','_result = df.to_json(orient="records", date_format="iso")');
  return code.join('\n');
}
export function score(m,final=true){return final ? [m.et1??m.ft1,m.et2??m.ft2] : [m.ft1,m.ft2];}
export function validateRows(input){
  const rows=Array.isArray(input)?input:input?.rows;
  if(!Array.isArray(rows)||!rows.length||rows.length>100000)throw new Error('Expected 1–100,000 rows');
  if(rows.some(r=>!r||Array.isArray(r)||typeof r!=='object'))throw new Error('Each row must be an object');
  if(rows.some(r=>Object.keys(r).some(k=>['__proto__','constructor','prototype'].includes(k))))throw new Error('Reserved field name');
  return rows;
}
export function makeOperation(type,params){return {id:crypto.randomUUID(),type,params,status:'pending',created_at:new Date().toISOString(),warnings:[]};}
export function recipeOperations(id){
  const op=(type,params={})=>makeOperation(type,params);
  switch(id){
    case 'overview':return [op('total'),op('aggregate',{group:'date',value:'total_goals',func:'sum'})];
    case 'team-path':return [op('sort',{field:'date',ascending:true})];
    case 'goals-leaders':return [op('filter',{field:'is_own_goal',operator:'eq',value:false}),op('aggregate',{group:'player_name',value:'event_id',func:'count'})];
    case 'goal-time':return [op('cut',{field:'minute_base'}),op('aggregate',{group:'minute_band',value:'event_id',func:'count'})];
    case 'group-matrix':return [op('visual_heatmap',{scope:{}})];
    case 'team-form':return [op('rolling',{group:'team_id',date:'date',value:'goals_for_90',window:3})];
    case 'match-drill':case 'join-lab':return [op('merge',{table:'goals',left:'match_id',right:'match_id',how:'left',validate:'one_to_many'})];
    case 'quality':return [op('missing')];
    case 'knockout':return [op('filter',{field:'stage',operator:'ne',value:'group'}),op('total')];
    case 'venue':return [op('total'),op('aggregate',{group:'venue_name',value:'total_goals',func:'sum'})];
    default:return [op('aggregate',{group:'team_id',value:'goals_for_90',func:'sum'})];
  }
}
export function atlasSession(id){
  const op=(type,params={})=>makeOperation(type,params);const custom=code=>op('custom',{code});const agg=op('aggregate',{group:'team_id',value:'goals_for_90',func:'sum'});
  const configs={
    1:['team_matches',[op('head',{n:10})]],
    2:['team_matches',[custom('df = df.dtypes.astype(str).rename("dtype").rename_axis("field").reset_index()')]],
    3:['team_matches',[op('describe')]],
    4:['team_matches',[op('select',{fields:['team_id','date','goals_for_90']})]],
    5:['team_matches',[op('filter',{field:'stage',operator:'eq',value:'group'})]],
    6:['team_matches',[agg,op('head',{n:10})]],
    7:['team_matches',[custom('df = df.set_index(["team_id", "match_id"]).reset_index()')]],
    8:['team_matches',[op('rename',{field:'goals_for_90',name:'regulation_goals'})]],
    9:['team_matches',[op('missing')]],
    10:['team_matches',[op('dropna',{field:'group'})]],
    11:['matches',[op('deduplicate',{field:'match_id'})]],
    12:['team_matches',[op('numeric',{field:'goals_for_90'})]],
    13:['teams',[op('strip',{field:'name_en'})]],
    14:['team_matches',[custom('df["clipped_goals"] = df["goals_for_90"].clip(upper=3)')]],
    15:['team_matches',[agg]],
    16:['team_matches',[custom('df["team_average"] = df.groupby("team_id")["goals_for_90"].transform("mean")')]],
    17:['team_matches',[custom('df = df["result_90"].value_counts().rename("count").rename_axis("result").reset_index()')]],
    18:['team_matches',[custom('df = df.groupby("team_id").filter(lambda g: len(g) >= 3)')]],
    19:['team_matches',recipeOperations('group-matrix')],
    20:['team_matches',[op('melt',{group:'team_id',fields:['goals_for_90','goals_against_90']})]],
    21:['team_matches',[custom('df = pd.crosstab(df["stage"], df["result_90"]).reset_index()')]],
    22:['team_matches',[custom('df = pd.json_normalize(df.to_dict(orient="records"))')]],
    23:['team_matches',[op('merge',{table:'teams',left:'team_id',right:'team_id',how:'left',validate:'many_to_one'})]],
    24:['team_matches',[custom('df = pd.concat([df.head(3), df.tail(3)], ignore_index=True)')]],
    25:['team_matches',[op('merge',{table:'teams',left:'team_id',right:'team_id',how:'left',validate:'many_to_one'})]],
    26:['team_matches',[custom('df["weekday"] = pd.to_datetime(df["date"]).dt.day_name()')]],
    27:['matches',[op('total'),custom('df["date"] = pd.to_datetime(df["date"])\ndf = df.set_index("date")["total_goals"].resample("W").sum().reset_index()')]],
    28:['team_matches',recipeOperations('team-form')],
    29:['team_matches',[custom('df = df.sort_values(["team_id", "date"])\ndf["ewm_goals"] = df.groupby("team_id")["goals_for_90"].transform(lambda s: s.ewm(span=3, adjust=False).mean())')]],
    30:['team_matches',[custom('df = df.sort_values(["team_id", "date"])\ndf["goal_change"] = df.groupby("team_id")["goals_for_90"].diff()')]],
    31:['team_matches',[custom('df = df.assign(net_goals=lambda d: d.goals_for_90 - d.goals_against_90)')]],
    32:['goals',recipeOperations('goal-time')],
    33:['team_matches',[custom('df["goal_rank_in_team"] = df.groupby("team_id")["goals_for_90"].rank(ascending=False, method="dense")')]],
    34:['team_matches',[custom('df = df.sort_values(["team_id", "date"])\ndf["cumulative_goals"] = df.groupby("team_id")["goals_for_90"].cumsum()')]],
    35:['team_matches',[custom('df = df[["goals_for_90", "goals_against_90", "goal_difference_90"]].corr().rename_axis("metric").reset_index()')]],
    36:['team_matches',[custom('df = df[["goals_for_90", "goals_against_90"]].quantile([0.25, 0.5, 0.75]).rename_axis("quantile").reset_index()')]],
    37:['team_matches',[custom('df["stage_code"] = df["stage"].astype("category").cat.codes')]],
    38:['team_matches',[custom('df = df.set_index(["team_id", "date"]).sort_index().reset_index()')]],
    39:['team_matches',[custom('df["points_90"] = df["result_90"].map({"W": 3, "D": 1, "L": 0})')]],
    40:['team_matches',recipeOperations('team-form')],
    41:['team_matches',[custom('from io import StringIO\ndf = pd.read_json(StringIO(df.to_json(orient="records")))')]],
    42:['team_matches',[custom('from io import StringIO\ndf = pd.read_csv(StringIO(df.to_csv(index=False)))')]],
    43:['team_matches',[custom('df["duplicate_key"] = df.duplicated(["match_id", "team_id"], keep=False)\ndf["missing_fields"] = df.isna().sum(axis=1)')]],
  };
  const [source,operations]=configs[id]||configs[1];return {source,operations};
}
