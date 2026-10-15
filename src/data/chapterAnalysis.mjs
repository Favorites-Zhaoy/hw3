export const ENGINE_VERSION='3.0.0';
export function compileChapter(chapter,config){
  if(!['quality','explore','teamsChapter','relations'].includes(chapter))throw new Error('Unknown chapter');
  return `import pandas as pd
import numpy as np
import json, io
cfg = json.loads(${JSON.stringify(JSON.stringify({...config,chapter}))})
tables = {k: pd.DataFrame(v) for k,v in json.loads(_tables_json).items()}
source = cfg['source']
versions=[]
for table_name,meta in cfg.get('registry',{}).items():
    if table_name==source or table_name not in tables: continue
    frame=tables[table_name].copy();before=list(frame.shape)
    for f,dtype in meta.get('types',{}).items():
        if f not in frame: continue
        if dtype=='date': frame[f]=pd.to_datetime(frame[f],errors='coerce',format='mixed',utc=True)
        elif dtype=='number': frame[f]=pd.to_numeric(frame[f],errors='coerce')
        elif dtype=='text': frame[f]=frame[f].astype('string')
        elif dtype=='boolean': frame[f]=frame[f].astype('string').str.lower().map({'true':True,'false':False}).astype('boolean')
    for op in meta.get('clean',[]):
        f=op.get('field');kind=op['type']
        if kind=='dropna': frame=frame.dropna(subset=[f]).copy()
        elif kind=='fillna': frame[f]=frame[f].fillna(op['value'])
        elif kind=='deduplicate': frame=frame.drop_duplicates(subset=op.get('keys') or list(frame.columns),keep=op.get('keep','first')).copy()
        elif kind=='number': frame[f]=pd.to_numeric(frame[f],errors='coerce')
        elif kind=='date': frame[f]=pd.to_datetime(frame[f],errors='coerce',format='mixed',utc=True)
        elif kind=='text': frame[f]=frame[f].astype('string')
        elif kind=='boolean': frame[f]=frame[f].astype('string').str.lower().map({'true':True,'false':False}).astype('boolean')
    tables[table_name]=frame;versions.append({'table':table_name,'before':before,'after':list(frame.shape)})
df = tables[source].copy()
df['__wcl_id'] = source + ':' + df.index.astype(str)
original = df.copy(deep=True)
steps = []
charts = {}
warnings = []
def records(frame):
    out = frame.copy()
    out.columns = [str(c) for c in out.columns]
    return json.loads(out.to_json(orient='records', date_format='iso'))
def step(code):
    before = list(df.shape)
    exec(code, globals())
    steps.append({'code':code, 'before':before, 'after':list(df.shape)})
def lit(value):
    return repr(value)
def public(frame):
    return frame.drop(columns=['__wcl_id'], errors='ignore')
def distribution(series, bins=10):
    valid=series.dropna()
    if valid.empty: return []
    if pd.api.types.is_numeric_dtype(valid) and not pd.api.types.is_bool_dtype(valid):
        counts=pd.cut(valid, bins=max(1,bins), duplicates='drop').value_counts(sort=False)
    elif pd.api.types.is_datetime64_any_dtype(valid):
        counts=valid.dt.strftime('%Y-%m-%d').value_counts().sort_index()
    else:
        counts=valid.astype(str).value_counts().head(15)
    return [{'key':str(k),'label':str(k),'value':int(v)} for k,v in counts.items()]
def profile(frame):
    info=io.StringIO(); public(frame).info(buf=info)
    result=[]
    for col in public(frame).columns:
        s=frame[col]; n=int(s.notna().sum()); inferred='text';invalid=0
        if pd.api.types.is_bool_dtype(s): inferred='boolean'
        elif pd.api.types.is_numeric_dtype(s) and n: inferred='number'
        elif pd.api.types.is_datetime64_any_dtype(s): inferred='date'
        elif n and s.dropna().astype(str).str.match(r'^\\d{4}-\\d{2}-\\d{2}').all(): inferred='date'
        override=cfg.get('types',{}).get(col)
        invalid_mask=pd.Series(False,index=s.index)
        raw=s
        if '__wcl_id' in frame and col in original:
            raw=pd.Series(original.set_index('__wcl_id')[col].reindex(frame['__wcl_id']).to_numpy(),index=s.index)
        if override=='number': invalid_mask=raw.notna() & pd.to_numeric(s,errors='coerce').isna()
        if override=='date': invalid_mask=raw.notna() & pd.to_datetime(s,errors='coerce',format='mixed',utc=True).isna()
        invalid=int(invalid_mask.sum());valid=int((s.notna() & ~invalid_mask).sum());missing=int((s.isna() & ~invalid_mask).sum())
        result.append({'field':str(col),'dtype':str(s.dtype),'type':override or inferred,'valid':valid,'missing':missing,'invalid':invalid,'complete':valid/len(frame)*100 if len(frame) else 0,'unique':int(s.astype('string').nunique())})
    return result, info.getvalue()

# The preparation chain is shared by all four chapters for this source table.
for field,dtype in cfg.get('types',{}).items():
    if field not in df: continue
    if dtype=='date': step('df['+lit(field)+'] = pd.to_datetime(df['+lit(field)+'], errors="coerce", format="mixed", utc=True)')
    elif dtype=='number': step('df['+lit(field)+'] = pd.to_numeric(df['+lit(field)+'], errors="coerce")')
    elif dtype=='text': step('df['+lit(field)+'] = df['+lit(field)+'].astype("string")')
    elif dtype=='boolean': step('df['+lit(field)+'] = df['+lit(field)+'].astype("string").str.lower().map({"true": True, "false": False}).astype("boolean")')
for op in cfg.get('clean',[]):
    field=op.get('field'); kind=op['type']
    if kind=='fillna': step('df['+lit(field)+'] = df['+lit(field)+'].fillna('+lit(op['value'])+')')
    elif kind=='dropna': step('df = df.dropna(subset=['+lit(field)+']).copy()')
    elif kind=='deduplicate': step('df = df.drop_duplicates(subset='+lit(op.get('keys') or list(public(df).columns))+', keep='+lit(op.get('keep','first'))+').copy()')
    elif kind=='number': step('df['+lit(field)+'] = pd.to_numeric(df['+lit(field)+'], errors="coerce")')
    elif kind=='date': step('df['+lit(field)+'] = pd.to_datetime(df['+lit(field)+'], errors="coerce", format="mixed", utc=True)')
    elif kind=='text': step('df['+lit(field)+'] = df['+lit(field)+'].astype("string")')
    elif kind=='boolean': step('df['+lit(field)+'] = df['+lit(field)+'].astype("string").str.lower().map({"true": True, "false": False}).astype("boolean")')
prepared=df.copy(deep=True)

if cfg['chapter']=='quality':
    if cfg.get('selectedIds'): step('df = df.loc[df["__wcl_id"].isin('+lit(cfg['selectedIds'])+')].copy()')
    prof,info=profile(df); before_prof,_=profile(original)
    prof=sorted(prof,key=lambda f:(f['field']!=cfg.get('field'),-f['missing'],f['field']))
    matrix_fields=[f['field'] for f in prof]
    field=cfg.get('field')
    if field not in df.columns: field=next(iter(public(df).columns),None)
    keys=cfg.get('duplicateKeys') or list(public(df).columns)
    if keys:
        duplicate=df.duplicated(subset=keys,keep=False)
        removing=df.duplicated(subset=keys,keep=cfg.get('keep','first'))
        dupgroups=public(df.loc[duplicate]).astype('string').value_counts(subset=keys,dropna=False).reset_index(name='count')
    else:
        duplicate=pd.Series(False,index=df.index);removing=duplicate;dupgroups=pd.DataFrame()
    start=max(0,int(cfg.get('pixelPage',0)))*100
    page=df.iloc[start:start+100]
    original_indexed=original.set_index('__wcl_id',drop=False)
    pixels=[]
    for _,r in page.iterrows():
        old=original_indexed.loc[r['__wcl_id']]
        pixels.append({'id':r['__wcl_id'],'missing':[bool(pd.isna(r[c])) for c in matrix_fields], 'changed':[bool(str(old[c])!=str(r[c])) for c in matrix_fields]})
    changes=[]
    changed_cells=0;current_indexed=df.set_index('__wcl_id',drop=False)
    for c in public(df).columns:
        a=original_indexed[c].reindex(current_indexed.index);b=current_indexed[c]
        mask=(a.astype('string').ne(b.astype('string')).fillna(False) | a.isna().ne(b.isna()))
        if a.dtype!=b.dtype: mask=mask | (a.notna() & b.notna())
        changed_cells+=int(mask.sum())
        for rid in mask.loc[mask].index[:max(0,1000-len(changes))]:
            av,bv=a.loc[rid],b.loc[rid];changes.append({'id':rid,'field':str(c),'before':None if pd.isna(av) else str(av),'after':None if pd.isna(bv) else str(bv)})
    summary=public(df).describe(include='all').astype('string').reset_index().rename(columns={'index':'statistic'}) if len(public(df).columns) else pd.DataFrame()
    preview=None
    op=cfg.get('previewOperation')
    if op:
        temp=df.copy(deep=True);f=op.get('field');kind=op['type'];preview_code='';changed=0
        if kind=='dropna':
            preview_code='preview = df.dropna(subset=['+lit(f)+'])';temp=temp.dropna(subset=[f])
        elif kind=='deduplicate':
            kk=op.get('keys') or list(public(df).columns);preview_code='preview = df.drop_duplicates(subset='+lit(kk)+', keep='+lit(op.get('keep','first'))+')';temp=temp.drop_duplicates(subset=kk,keep=op.get('keep','first'))
        else:
            if kind=='fillna': replacement=temp[f].fillna(op['value']);preview_code='preview['+lit(f)+'] = df['+lit(f)+'].fillna('+lit(op['value'])+')'
            elif kind=='number': replacement=pd.to_numeric(temp[f],errors='coerce');preview_code='preview['+lit(f)+'] = pd.to_numeric(df['+lit(f)+'], errors="coerce")'
            elif kind=='date': replacement=pd.to_datetime(temp[f],errors='coerce',format='mixed',utc=True);preview_code='preview['+lit(f)+'] = pd.to_datetime(df['+lit(f)+'], errors="coerce", format="mixed", utc=True)'
            elif kind=='boolean': replacement=temp[f].astype('string').str.lower().map({'true':True,'false':False}).astype('boolean');preview_code='preview['+lit(f)+'] = df['+lit(f)+'].astype("string").str.lower().map({"true": True, "false": False}).astype("boolean")'
            else: replacement=temp[f].astype('string');preview_code='preview['+lit(f)+'] = df['+lit(f)+'].astype("string")'
            changed=int(((temp[f].astype('string')!=replacement.astype('string')).fillna(False) | (temp[f].isna()!=replacement.isna())).sum());temp[f]=replacement
        preview={'operation':op,'before':len(df),'after':len(temp),'changed':changed,'code':preview_code}
    membership=[]
    if field and df[field].notna().any():
        if pd.api.types.is_numeric_dtype(df[field]) and not pd.api.types.is_bool_dtype(df[field]): labels=pd.cut(df[field],bins=10,duplicates='drop').astype('string')
        elif pd.api.types.is_datetime64_any_dtype(df[field]): labels=df[field].dt.strftime('%Y-%m-%d').astype('string')
        else: labels=df[field].astype('string')
        membership=[{'id':df.loc[i,'__wcl_id'],'key':str(k)} for i,k in labels.dropna().items()]
    charts={'profile':prof,'beforeProfile':before_prof,'info':info,'pixels':pixels,'pageStart':start,'distribution':distribution(df[field]) if field else [],'membership':membership,'describe':records(summary),'duplicates':records(dupgroups),'duplicateRows':int(duplicate.sum()),'removeDuplicates':int(removing.sum()),'dropPreview':int(df[field].isna().sum()) if field else 0,'changes':changes,'changedCells':changed_cells,'removedRows':len(original)-len(df),'cleanPreview':preview,'tableSizes':[{'key':k,'label':k,'value':len(v),'columns':len(v.columns),'nonNull':int(v.notna().sum().sum())} for k,v in tables.items()]}
    steps.append({'code':"df.info()\\ndf.describe(include='all')\\ndf.isna().sum()\\ndf.duplicated(subset="+lit(keys)+", keep="+lit(cfg.get('keep','first'))+")",'before':list(df.shape),'after':list(df.shape)})

elif cfg['chapter']=='explore':
    world=all(k in df.columns for k in ['ft1','ft2','match_id'])
    if world:
        a="df['et1'].combine_first(df['ft1'])" if cfg.get('final',True) else "df['ft1']"
        b="df['et2'].combine_first(df['ft2'])" if cfg.get('final',True) else "df['ft2']"
        step('df = df.assign(total_goals='+a+' + '+b+', goal_margin=('+a+' - '+b+').abs())')
        df['__wcl_extra']=df['et1'].notna()
    x,y=cfg.get('x'),cfg.get('y')
    masks=[]
    for condition in cfg.get('conditions',[]):
        f,op,v=condition['field'],condition['operator'],condition['value']
        if f not in df.columns: continue
        expr="df["+lit(f)+"]"
        if op=='between': code=expr+'.between('+lit(v[0])+', '+lit(v[1])+', inclusive="both")'
        elif op=='isin': code=expr+'.isin('+lit(v)+')'
        elif op=='contains': code=expr+'.astype("string").str.contains('+lit(str(v))+', regex=False, na=False)'
        elif op=='isnull': code=expr+'.isna()'
        else: code=expr+{'eq':' == ','ge':' >= ','le':' <= ','gt':' > ','lt':' < ','ne':' != '}.get(op,' == ')+lit(v)
        masks.append('('+code+')')
    if masks: step('df = df.loc['+(' | ' if cfg.get('logic')=='or' else ' & ').join(masks)+'].copy()')
    if cfg.get('selectedIds'): step('df = df.loc[df["__wcl_id"].isin('+lit(cfg['selectedIds'])+')].copy()')
    if cfg.get('matchIds') and 'match_id' in df: step('df = df.loc[df["match_id"].isin('+lit(cfg['matchIds'])+')].copy()')
    if cfg.get('teamIds') and world: step('df = df.loc[df["team1_id"].isin('+lit(cfg['teamIds'])+') | df["team2_id"].isin('+lit(cfg['teamIds'])+')].copy()')
    bins=max(3,min(10,int(cfg.get('bins',5))))
    equal=[];quantile=[];edges=[]
    if x in df and pd.api.types.is_numeric_dtype(df[x]) and df[x].notna().any():
        step('df["__wcl_cut"] = pd.cut(df['+lit(x)+'], bins='+str(bins)+', duplicates="drop")')
        step('df["__wcl_qcut"] = pd.qcut(df['+lit(x)+'], q='+str(bins)+', duplicates="drop")')
        equal=[{'key':str(k),'label':str(k),'value':int(v)} for k,v in df['__wcl_cut'].value_counts(sort=False).items()]
        quantile=[{'key':str(k),'label':str(k),'value':int(v)} for k,v in df['__wcl_qcut'].value_counts(sort=False).items()]
        edges=[str(k) for k in df['__wcl_qcut'].cat.categories]
        df['__wcl_cut']=df['__wcl_cut'].astype('string');df['__wcl_qcut']=df['__wcl_qcut'].astype('string')
    if y in df and pd.api.types.is_numeric_dtype(df[y]) and df[y].notna().any(): df['__wcl_ycut']=pd.cut(df[y],bins=bins,duplicates='drop').astype('string')
    sort=cfg.get('sort')
    if sort in df: step('df = df.sort_values('+lit(sort)+', ascending='+lit(cfg.get('ascending',False))+', kind="stable", na_position="last")')
    types=[]
    if world:
        df['__wcl_type']=np.select([df.goal_margin.eq(0),df.goal_margin.ge(cfg.get('bigMargin',3)),df.total_goals.ge(cfg.get('highGoals',4))],['draw','large_margin','high_goals'],default='close')
        types=[{'key':str(k),'label':str(k),'value':int(v)} for k,v in df['__wcl_type'].value_counts().items()]
    dates=[];date=cfg.get('date')
    if date in df:
        parsed=pd.to_datetime(df[date],errors='coerce',format='mixed',utc=True);dates=[{'key':str(k),'label':str(k),'value':int(v)} for k,v in parsed.dt.strftime('%Y-%m-%d').value_counts().sort_index().items()]
    charts={'world':world,'points':records(df),'xDistribution':distribution(df[x],bins) if x in df else [],'yDistribution':distribution(df[y],bins) if y in df else [],'equal':equal,'quantile':quantile,'actualBins':len(edges),'requestedBins':bins,'edges':edges,'types':types,'dates':dates,'ranking':records(df.head(int(cfg.get('top',10)))),'numeric':list(df.select_dtypes(include='number').columns)}

elif cfg['chapter']=='teamsChapter':
    world=all(k in df for k in ['team_id','goals_for_90','goals_against_90'])
    if cfg.get('matchIds') and 'match_id' in df: step('df = df.loc[df["match_id"].isin('+lit(cfg['matchIds'])+')].copy()')
    if cfg.get('teamIds') and 'team_id' in df: step('df = df.loc[df["team_id"].isin('+lit(cfg['teamIds'])+')].copy()')
    row,col,value=cfg.get('row'),cfg.get('column'),cfg.get('value');func=cfg.get('func','mean')
    if func not in ['sum','mean','count','std','min','max','median']: raise ValueError('AGGREGATION')
    if row not in df or value not in df: raise ValueError('SELECT_DIMENSION_AND_MEASURE')
    basis=df.copy(deep=True)
    numeric=pd.to_numeric(df[value],errors='coerce')
    if func!='count' and not numeric.notna().any(): warnings.append('NO_NUMERIC_VALUES')
    nonnumeric=not numeric.notna().any() and func=='count'
    if nonnumeric:
        original_value=value;value='__wcl_count_value';mask=df[original_value].notna();df[value]=mask.astype(float).where(mask)
    else: df[value]=numeric
    groupcode='summary = df.groupby('+lit(row)+', dropna=False).agg(total=('+lit(value)+', "sum"), average=('+lit(value)+', "mean"), maximum=('+lit(value)+', "max"), std=('+lit(value)+', "std"), played=('+lit(value)+', "count"), records=('+lit(value)+', "size")).reset_index()'
    step(groupcode)
    summary.loc[summary.played.eq(0),['total','average','maximum','std']]=np.nan
    summary['team_id']=summary[row].astype('string');summary['total_goals']=summary['total'];summary['average_goals']=summary['average'];summary['goal_std']=summary['std']
    summary['rank_total']=summary.total.rank(method='min',ascending=False);summary['rank_average']=summary.average.rank(method='min',ascending=False)
    summary['order_total']=summary.total.rank(method='first',ascending=False);summary['order_average']=summary.average.rank(method='first',ascending=False);summary['rank_change']=summary.rank_total-summary.rank_average
    step('df["__wcl_group_mean"] = df.groupby('+lit(row)+', dropna=False)['+lit(value)+'].transform("mean")')
    football_metric=world and row=='team_id' and value in ['goals_for_90','goals_for_final']
    if football_metric:
        against='goals_against_90' if value.endswith('_90') else 'goals_against_final'
        defense=df.groupby('team_id').agg(average_conceded=(against,'mean'),clean_sheets=(against,lambda s:int(s.eq(0).sum())),wins=('win',lambda s:int(s.fillna(False).sum()))).reset_index()
        summary=summary.merge(defense,on='team_id',validate='one_to_one')
        stages=['group','round_of_32','round_of_16','quarter_final','semi_final','match_for_third_place','final']
        deepest=df.assign(__stage=df['stage'].map({s:i for i,s in enumerate(stages)})).sort_values('__stage').groupby('team_id').tail(1)[['team_id','stage']].rename(columns={'stage':'furthest_stage'})
        summary=summary.merge(deepest,on='team_id',validate='one_to_one')
    else: summary['average_conceded']=summary['std'];summary['furthest_stage']=''
    if col in df and col!=row:
        step('pivot = pd.pivot_table(df, index='+lit(row)+', columns='+lit(col)+', values='+lit(value)+', aggfunc='+lit(func)+', dropna=False)')
    else:
        step('pivot = df.groupby('+lit(row)+', dropna=False)[['+lit(value)+']].agg('+lit(func)+')')
    # Sum on an all-null group must remain unavailable, rather than a fabricated zero.
    if col in df and col!=row: pivot=pivot.where(pd.pivot_table(df,index=row,columns=col,values=value,aggfunc='count',dropna=False).gt(0))
    else: pivot=pivot.where(df.groupby(row,dropna=False)[[value]].count().gt(0))
    summary=summary.sort_values(['rank_total','team_id'],kind='stable',na_position='last')
    focus=str(cfg.get('focus') or (summary.iloc[0]['team_id'] if len(summary) else ''))
    date=cfg.get('date');trend=pd.DataFrame();resampled=pd.DataFrame();cross=pd.DataFrame()
    if date in df:
        step('df['+lit(date)+'] = pd.to_datetime(df['+lit(date)+'], errors="coerce", format="mixed", utc=True)')
        trend=df.loc[df[row].astype('string').eq(focus)].sort_values(date,kind='stable').copy()
        trend['match_index']=np.arange(1,len(trend)+1);trend['goals']=trend[value];trend['date']=trend[date].dt.strftime('%Y-%m-%d')
        trend['rolling_goals']=trend[value].rolling(${Math.max(2,Math.min(5,Number(config.window)||3))}, min_periods=1).mean();trend['cumulative_goals']=trend[value].cumsum()
        steps.append({'code':'trend["rolling_goals"] = trend['+lit(value)+'].rolling(${Math.max(2,Math.min(5,Number(config.window)||3))}, min_periods=1).mean()','before':list(trend.shape),'after':list(trend.shape)})
        freq=cfg.get('frequency','W');freq=freq if freq in ['D','W','MS'] else 'W'
        timed=df.loc[df[date].notna()].set_index(date)
        resampled=timed[[value]].resample(freq).sum(min_count=1).reset_index();resampled[date]=resampled[date].dt.strftime('%Y-%m-%d')
        steps.append({'code':'df.set_index('+lit(date)+')[['+lit(value)+']].resample('+lit(freq)+').sum(min_count=1)','before':list(df.shape),'after':list(resampled.shape)})
    if col in df and col!=row: cross=pd.crosstab(df[row],df[col]).reset_index()
    charts={'world':football_metric,'countOnly':nonnumeric,'groups':records(summary),'rankShift':records(summary.loc[((summary.rank_total.le(8)) | (summary.rank_average.le(8))) & summary.average.notna()]),'pivot':{'rows':[str(k) for k in pivot.index][:50],'cols':[str(k) for k in pivot.columns][:30],'values':json.loads(pivot.iloc[:50,:30].to_json(orient='values')),'totalRows':len(pivot.index),'totalColumns':len(pivot.columns)},'trend':records(trend),'focus':focus,'resampled':records(resampled),'cross':records(cross),'basis':records(basis),'distribution':distribution(df[value]),'measure':value}
    df=summary.copy()

else:
    mode=cfg.get('relationMode','merge');right=cfg.get('right');left=df.copy();rightframe=tables.get(right,pd.DataFrame()).copy()
    if cfg.get('matchIds') and 'match_id' in df: step('df = df.loc[df["match_id"].isin('+lit(cfg['matchIds'])+')].copy()');left=df.copy()
    if cfg.get('teamIds') and cfg.get('worldcupContext') and 'match_id' in df:
        scope_matches=tables['matches'].loc[tables['matches'].team1_id.isin(cfg['teamIds']) | tables['matches'].team2_id.isin(cfg['teamIds']),'match_id']
        step('df = df.loc[df["match_id"].isin(scope_matches)].copy()');left=df.copy()
    rightframe['__wcl_right_id']=str(right)+':'+rightframe.index.astype(str)
    if cfg.get('worldcupContext') and not cfg.get('final',True):
        if source=='goals': step('df = df.loc[df["minute_base"].le(90)].copy()');left=df.copy()
        if right=='goals': rightframe=rightframe.loc[rightframe.minute_base.le(90)].copy()
    lk,rk=cfg.get('leftKey'),cfg.get('rightKey')
    outer=pd.DataFrame();flow=[]
    if mode in ['merge','join']:
        if lk not in df or rk not in rightframe: raise ValueError('SELECT_JOIN_KEYS')
        left_dupes=int(df[lk].duplicated(keep=False).sum());right_dupes=int(rightframe[rk].duplicated(keep=False).sum())
        # Exact output weights from key frequencies avoid materializing a dangerous Cartesian product just to preview it.
        lc=df[lk].value_counts(dropna=False).rename('__left_n').rename_axis('__key').reset_index()
        rc=rightframe[rk].value_counts(dropna=False).rename('__right_n').rename_axis('__key').reset_index()
        key_counts=lc.merge(rc,on='__key',how='outer',indicator=True)
        key_counts['__weight']=key_counts.__left_n.fillna(1)*key_counts.__right_n.fillna(1)
        flow=[{'key':k,'label':k,'value':int(key_counts.loc[key_counts['_merge'].eq(k),'__weight'].sum())} for k in ['left_only','both','right_only']]
        outer=pd.DataFrame(index=range(min(100001,sum(r['value'] for r in flow))))
        if len(outer)>100000: raise ValueError('JOIN_TOO_LARGE: '+str(sum(r['value'] for r in flow))+' output rows; inspect duplicate keys before joining')
        how=cfg.get('how','left');validate=cfg.get('validate','many_to_one')
        if how not in ['left','right','inner','outer']: raise ValueError('JOIN_MODE')
        if validate not in ['one_to_one','one_to_many','many_to_one','many_to_many']: raise ValueError('CARDINALITY')
        if mode=='join': step('df = df.join(rightframe.set_index('+lit(rk)+'), on='+lit(lk)+', how='+lit(how)+', validate='+lit(validate)+', rsuffix="_right")')
        else: step('df = df.merge(rightframe, left_on='+lit(lk)+', right_on='+lit(rk)+', how='+lit(how)+', validate='+lit(validate)+', suffixes=("", "_right"), indicator=True)')
        if left_dupes and right_dupes: warnings.append('MANY_TO_MANY')
    elif mode=='concat':
        axis=int(cfg.get('axis',0));axis=axis if axis in [0,1] else 0
        step('df = pd.concat([df, rightframe], axis='+str(axis)+', join='+lit(cfg.get('join','outer'))+', ignore_index='+lit(axis==0)+')')
        left_dupes=right_dupes=0
        if not df.columns.is_unique: df.columns=[str(c)+'__'+str(i) for i,c in enumerate(df.columns)]
    else:
        left_dupes=right_dupes=0
    vars=[v for v in cfg.get('valueVars',[]) if v in left];ids=[v for v in cfg.get('idVars',[]) if v in left and v not in vars]
    melted=left.melt(id_vars=ids+['__wcl_id'],value_vars=vars,var_name='metric',value_name='value') if vars else pd.DataFrame()
    stacked_series=left.set_index('__wcl_id')[vars].stack(future_stack=True) if vars else pd.Series(dtype=object)
    stacked=stacked_series.rename('value').reset_index() if vars else pd.DataFrame()
    unstacked=stacked_series.unstack() if vars else pd.DataFrame()
    if mode=='melt': step('df = df.melt(id_vars='+lit(ids+['__wcl_id'])+', value_vars='+lit(vars)+', var_name="metric", value_name="value")')
    steps.append({'code':'melted = left.melt(id_vars='+lit(ids+['__wcl_id'])+', value_vars='+lit(vars)+', var_name="metric", value_name="value")\\nstacked_series = left.set_index("__wcl_id")['+lit(vars)+'].stack(future_stack=True)\\nunstacked = stacked_series.unstack()','before':list(left.shape),'after':list(melted.shape)})
    match=None;events=pd.DataFrame();all_events=pd.DataFrame();progress=[];match_list=[]
    can_reconstruct=cfg.get('worldcupContext') and 'match_id' in df and 'matches' in tables and 'goals' in tables and all(c in tables['matches'] for c in ['match_id','team1_id','team2_id'])
    if mode in ['merge','join'] and {source,right}=={'goals','matches'} and (lk!='match_id' or rk!='match_id'):
        can_reconstruct=False;warnings.append('MATCH_KEY_REQUIRED')
    if can_reconstruct:
        candidates=tables['matches'].copy()
        if cfg.get('matchIds'): candidates=candidates.loc[candidates.match_id.isin(cfg['matchIds'])]
        if cfg.get('teamIds'): candidates=candidates.loc[candidates.team1_id.isin(cfg['teamIds']) | candidates.team2_id.isin(cfg['teamIds'])]
        match_list=records(candidates)
        chosen=candidates.loc[candidates.match_id.eq(cfg.get('matchId'))]
        if chosen.empty: chosen=candidates.head(1)
        if len(chosen):
            match=records(chosen)[0]
            event_pool=tables['goals']
            event_pool=event_pool.loc[event_pool.match_id.isin(df.match_id.dropna())]
            if 'event_id' in df: event_pool=event_pool.loc[event_pool.event_id.isin(df.event_id.dropna())]
            events=event_pool.merge(chosen[['match_id','date','stage']],on='match_id',how='inner',validate='many_to_one')
            all_events=event_pool.merge(tables['matches'][['match_id','date','stage']],on='match_id',how='inner',validate='many_to_one')
            if not cfg.get('final',True): all_events=all_events.loc[all_events.minute_base.le(90)]
            bands=['01–15','16–30','31–45','46–60','61–75','76–90','91–105','106–120','121+']
            all_events['minute_band']=pd.cut(all_events.minute_base,bins=[0,15,30,45,60,75,90,105,120,150],labels=bands,include_lowest=True).astype('string')
            all_events['dot_index']=all_events.groupby(['stage','minute_band'],dropna=False).cumcount()
            if not cfg.get('final',True): events=events.loc[events.minute_base.le(90)]
            events=events.sort_values(['minute_base','minute_added','event_id'],kind='stable')
            home=away=0;progress=[{'minute':0,'home':0,'away':0,'label':'0'}]
            for _,e in events.iterrows():
                home+=int(e.scoring_team_id==match['team1_id']);away+=int(e.scoring_team_id==match['team2_id']);progress.append({'minute':int(e.minute_base),'home':home,'away':away,'label':str(e.minute_label),'event_id':e.event_id})
            expected=[match.get('et1') if cfg.get('final',True) and match.get('et1') is not None else match['ft1'],match.get('et2') if cfg.get('final',True) and match.get('et2') is not None else match['ft2']]
            if [home,away]!=expected: warnings.append('EVENT_SCORE_MISMATCH')
            steps.append({'code':'events = event_pool.merge(chosen[["match_id", "date", "stage"]], on="match_id", how="inner", validate="many_to_one")','before':list(tables['goals'].shape),'after':list(events.shape)})
    charts={'flow':flow,'leftRows':len(left),'rightRows':len(rightframe),'leftDuplicates':left_dupes,'rightDuplicates':right_dupes,'outerRows':len(outer),'leftPreview':records(left.head(8)),'rightPreview':records(rightframe.head(8)),'long':records(melted),'stacked':records(stacked),'widePreview':records(left[ids+vars+['__wcl_id']].head(5)) if vars else [],'match':match,'events':records(events),'allEvents':records(all_events),'progress':progress,'matches':match_list,'schema':[{'table':k,'fields':[str(c) for c in v.columns], 'rows':len(v)} for k,v in tables.items()]}

prof,info=profile(df)
payload={'engine':'pandas','pandasVersion':pd.__version__,'version':'${ENGINE_VERSION}','chapter':cfg['chapter'],'source':source,'inputRows':len(original),'inputColumns':len(public(original).columns),'outputRows':len(df),'outputColumns':len(public(df).columns),'rows':records(df.head(10000)),'original':records(original.head(10000)),'prepared':records(prepared.head(10000)),'columns':[str(k) for k in public(df).columns],'profile':prof,'charts':charts,'steps':steps,'versions':versions,'warnings':warnings,'truncated':len(df)>10000}
_result=json.dumps([payload], ensure_ascii=False, allow_nan=False)
`;
}
