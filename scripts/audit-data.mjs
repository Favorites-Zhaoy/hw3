import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditTables} from '../src/data/audit.mjs';
const reports=[];
for(const base of ['public/data/2026/','public/data/2026/full/']){
  const tables=Object.fromEntries(await Promise.all(['matches','team_matches','goals','teams','venues'].map(async k=>[k,JSON.parse(await readFile(base+k+'.json','utf8')).rows])));
  const report={...auditTables(tables),source_sha256:createHash('sha256').update(JSON.stringify(tables)).digest('hex'),checked_at:new Date().toISOString(),external_checks:JSON.parse(await readFile('scripts/external-checks.json','utf8'))};
  report.allow_complete_claim=base.includes('/full/')&&report.passed&&report.counts.matches===104&&report.counts.teams===48;
  await writeFile(base+'data_audit.json',JSON.stringify(report,null,2)+'\n');reports.push({base,report});
  console.log(base,report.passed?'PASS':'FAIL',report.counts,report.errors.slice(0,5));
}
const full=reports[1].report;
await writeFile('data_audit.json',JSON.stringify(full,null,2)+'\n');
await writeFile('DATA_AUDIT.md',`# 数据审计 / Data audit\n\nGenerated: ${full.checked_at}\n\n来源：公开社区 openfootball/worldcup.json；自动一致性通过不等于全赛事官方认证。\n\n${reports.map(({base,report:r})=>`## ${base}\n\nStatus: **${r.passed?'PASS':'FAIL'}**. Complete-scope display allowed: ${r.allow_complete_claim}.\n\n| Table | Rows | Key | Missing cells |\n| --- | ---: | --- | ---: |\n${Object.entries(r.counts).map(([k,n])=>`| ${k} | ${n} | ${r.primary_keys[k]} | ${Object.values(r.missing[k]).reduce((a,b)=>a+b,0)} |`).join('\n')}\n\n${r.errors.length?'Errors: '+JSON.stringify(r.errors):'主键、外键、球队双视角、90 分钟/加时比分、事件得分方、乌龙球、点球大战与时间文本检查通过。日期按源比赛当地日期保留。'}\n`).join('\n')}\n## 独立抽查 / Independent spot checks\n\n核验日期：2026-10-15。下列来源独立于社区数据；核验限于列出的字段，未逐条核验全赛事。\n\n${full.external_checks.map(c=>`- **${c.match}** — ${c.checked}. [Source](${c.url}). ${c.note||''}`).join('\n')}\n\n## 规范化修正\n\n旧离线样本 m_82c2b4899a8d-g2-2 原始时刻为 92，原先误作加时。现保留 minute_label=92，将排序字段改为 minute_base=90、minute_added=2、phase=second_half。未改动比分或进球总数；已重算样本缓存。\n\n## 口径与限制\n\n- 比赛进球包含加时，排除点球大战；90+ 补时仍属于 90 分钟口径。乌龙球记受益方。\n- 相同基础分钟和补时的事件保留原始顺序，不推测秒数。\n- missing/null、0、未参加阶段分别保留；xG、射门、控球、地理坐标未提供，不估计。\n- JSON 报告包含逐字段缺失数和源指纹。构建前重跑审计；全量失败阻止构建，加载时重新核验并拒绝错误数据。\n- 第三方上传数据采用字段能力判断；其内容真实性未获独立认证。\n`);
if(reports.some(({report})=>!report.passed))process.exitCode=1;
