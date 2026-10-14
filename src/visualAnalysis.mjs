export const BANDS=['01–15','16–30','31–45','46–60','61–75','76–90','91–105','106–120','121+'];
export const STAGES=['group','round_of_32','round_of_16','quarter_final','semi_final','match_for_third_place','final'];
export const DEFAULT_SCOPE={team:'',group:'',start:'',end:'',stage:'',final:true,window:3};
export function normalizeScope(scope={}){
  const s={...DEFAULT_SCOPE,...scope};return {team:String(s.team||''),group:String(s.group||''),start:String(s.start||''),end:String(s.end||''),stage:String(s.stage||''),final:s.final!==false,window:Math.max(2,Math.min(5,Number(s.window)||3))};
}
export const scopeKey=scope=>JSON.stringify(normalizeScope(scope));
// This exact Python definition is used by the build script, browser worker and code panels.
export function compileVisualAnalysis(scope={}){
  return `import pandas as pd
import json
tables = {k: pd.DataFrame(v) for k, v in json.loads(_tables_json).items()}
scope = json.loads(${JSON.stringify(scopeKey(scope))})
bands = ${JSON.stringify(BANDS)}
stage_order = ${JSON.stringify(STAGES)}

# SECTION scope
matches = tables["matches"].copy()
if scope["group"]:
    matches = matches.loc[matches["group"].eq(scope["group"])].copy()
if scope["stage"]:
    matches = matches.loc[matches["stage"].eq(scope["stage"])].copy()
if scope["start"]:
    matches = matches.loc[matches["date"].ge(scope["start"])].copy()
if scope["end"]:
    matches = matches.loc[matches["date"].le(scope["end"])].copy()
if scope["team"]:
    matches = matches.loc[matches["team1_id"].eq(scope["team"]) | matches["team2_id"].eq(scope["team"])].copy()
tm = tables["team_matches"].loc[tables["team_matches"]["match_id"].isin(matches["match_id"])].copy()
if scope["team"]:
    tm = tm.loc[tm["team_id"].eq(scope["team"])].copy()
gf = "goals_for_final" if scope["final"] else "goals_for_90"
ga = "goals_against_final" if scope["final"] else "goals_against_90"
events = tables["goals"].merge(matches[["match_id", "date", "stage", "group", "venue_name"]], on="match_id", validate="many_to_one")
if scope["team"]:
    events = events.loc[events["scoring_team_id"].eq(scope["team"])].copy()
if not scope["final"]:
    events = events.loc[events["minute_base"].le(90)].copy()
# END scope

# SECTION teams
tm = tm.assign(clean_sheet=tm[ga].eq(0), win_90=tm["result_90"].eq("W"), draw_90=tm["result_90"].eq("D"), loss_90=tm["result_90"].eq("L"))
teams = tm.groupby("team_id", as_index=False).agg(
    played=("match_id", "size"), total_goals=(gf, "sum"), average_goals=(gf, "mean"),
    maximum_goals=(gf, "max"), goal_std=(gf, "std"), conceded=(ga, "sum"),
    average_conceded=(ga, "mean"), clean_sheets=("clean_sheet", "sum"),
    wins=("win_90", "sum"), draws=("draw_90", "sum"), losses=("loss_90", "sum"))
teams = teams.assign(net_goals=teams.total_goals-teams.conceded)
teams = teams.sort_values("team_id", kind="stable")
teams["rank_total"] = teams["total_goals"].rank(ascending=False, method="min")
teams["rank_average"] = teams["average_goals"].rank(ascending=False, method="min")
teams["order_total"] = teams["total_goals"].rank(ascending=False, method="first")
teams["order_average"] = teams["average_goals"].rank(ascending=False, method="first")
teams["order_maximum"] = teams["maximum_goals"].rank(ascending=False, method="first")
teams["order_std"] = teams["goal_std"].rank(ascending=False, method="first")
teams["rank_change"] = teams["rank_total"] - teams["rank_average"]
stage_lookup = tm.assign(stage_index=tm["stage"].map({s:i for i,s in enumerate(stage_order)})).groupby("team_id")["stage_index"].max().rename("stage_index").reset_index()
teams = teams.merge(stage_lookup, on="team_id", validate="one_to_one")
teams["furthest_stage"] = teams["stage_index"].map(dict(enumerate(stage_order)))
teams = teams.sort_values(["order_total", "team_id"], kind="stable")
rank_shift = teams.loc[teams["rank_total"].le(8) | teams["rank_average"].le(8)].copy()
# END teams

# SECTION timing
events["minute_band"] = pd.cut(events["minute_base"], bins=[0,15,30,45,60,75,90,105,120,150], labels=bands, include_lowest=True).astype("string")
timing = events.groupby("minute_band").size().reindex(bands, fill_value=0).rename("goals").rename_axis("minute_band").reset_index()
events = events.sort_values(["stage", "minute_base", "minute_added", "event_id"], kind="stable")
events["dot_index"] = events.groupby(["stage", "minute_band"]).cumcount()
# END timing

# SECTION heatmap
exposure = matches.groupby("stage").size().rename("matches")
active_stages = [s for s in stage_order if s in exposure.index]
counts = events.pivot_table(index="stage", columns="minute_band", values="event_id", aggfunc="count", fill_value=0).reindex(index=active_stages, columns=bands, fill_value=0).fillna(0)
heatmap = counts.reset_index().melt(id_vars="stage", var_name="minute_band", value_name="goals")
heatmap = heatmap.merge(exposure.reset_index(), on="stage", validate="many_to_one")
heatmap["goals_per_match"] = heatmap["goals"] / heatmap["matches"]
# END heatmap

# SECTION trend
trend = tm.sort_values(["team_id", "date", "match_id"], kind="stable").copy()
trend["match_index"] = trend.groupby("team_id").cumcount()+1
trend["goals"] = trend[gf]
trend["conceded_goals"] = trend[ga]
trend["cumulative_goals"] = trend.groupby("team_id")[gf].cumsum()
trend["rolling_goals"] = trend.groupby("team_id")[gf].transform(lambda s: s.rolling(${normalizeScope(scope).window}, min_periods=1).mean())
# END trend

# SECTION daily
daily = events.groupby("date").size().rename("goals").reset_index()
daily = matches.groupby("date").size().rename("matches").reset_index().merge(daily, on="date", how="left", validate="one_to_one")
daily["goals"] = daily["goals"].fillna(0)
daily = daily.sort_values("date", kind="stable")
# END daily

def records(df):
    return json.loads(df.to_json(orient="records", date_format="iso", double_precision=10))
summary = {"matches": int(len(matches)), "goals": int(tm[gf].sum()), "teams": int(tm["team_id"].nunique()), "average": float(tm[gf].sum()/len(matches)) if len(matches) else None, "events": int(len(events)), "stoppage_goals": int(events["minute_added"].gt(0).sum())}
payload = {"scope":scope, "summary":summary, "teams":records(teams), "rank_shift":records(rank_shift), "timing":records(timing), "events":records(events), "heatmap":records(heatmap), "trend":records(trend[["team_id","match_id","date","stage","match_index","goals","conceded_goals","cumulative_goals","rolling_goals"]]), "daily":records(daily), "matches":records(matches)}
payload["findings"] = {"total_leader":records(teams.head(1)), "average_leader":records(teams.sort_values("order_average").head(1)), "largest_rise":records(teams.sort_values(["rank_change", "team_id"], ascending=[False, True]).head(1)), "peak_time":records(timing.sort_values("goals", ascending=False, kind="stable").head(1))}
_result = json.dumps([payload], ensure_ascii=False, allow_nan=False)
`;
}
export function visualCodeSection(scope,section){const code=compileVisualAnalysis(scope);const start=code.indexOf('# SECTION '+section);const end=code.indexOf('# END '+section);return start<0?code:code.slice(start,end).trim();}
