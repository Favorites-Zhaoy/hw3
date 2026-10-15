# 数据审计 / Data audit

Generated: 2026-10-15T09:11:02.449Z

来源：公开社区 openfootball/worldcup.json；自动一致性通过不等于全赛事官方认证。

## public/data/2026/

Status: **PASS**. Complete-scope display allowed: false.

| Table | Rows | Key | Missing cells |
| --- | ---: | --- | ---: |
| matches | 26 | match_id | 154 |
| team_matches | 52 | match_id,team_id | 224 |
| goals | 78 | event_id | 234 |
| teams | 18 | team_id | 6 |
| venues | 15 | venue_id | 60 |

主键、外键、球队双视角、90 分钟/加时比分、事件得分方、乌龙球、点球大战与时间文本检查通过。日期按源比赛当地日期保留。

## public/data/2026/full/

Status: **PASS**. Complete-scope display allowed: true.

| Table | Rows | Key | Missing cells |
| --- | ---: | --- | ---: |
| matches | 104 | match_id | 618 |
| team_matches | 208 | match_id,team_id | 896 |
| goals | 308 | event_id | 924 |
| teams | 48 | team_id | 0 |
| venues | 16 | venue_id | 64 |

主键、外键、球队双视角、90 分钟/加时比分、事件得分方、乌龙球、点球大战与时间文本检查通过。日期按源比赛当地日期保留。

## 独立抽查 / Independent spot checks

核验日期：2026-10-15。下列来源独立于社区数据；核验限于列出的字段，未逐条核验全赛事。

- **Mexico – South Africa, 2026-06-11** — 2–0, half-time 1–0. [Source](https://fdp.fifa.org/assetspublic/ce281/r12452/pdf/FullTimeMatchReport-English.pdf). FIFA official full-time report; advanced statistics are not imported.
- **Qatar – Switzerland, 2026-06-13** — 1–1, Embolo 17′; Muheim own goal 90+4′ credited to Qatar. [Source](https://fdp.fifa.org/assetspublic/ce281/r12456/pdf/FullTimeMatchReport-English.pdf). FIFA updated report v2, pages 1–3. The report includes a correction to the goal attribution.
- **Germany – Paraguay, 2026-06-29** — 1–1 after 120 minutes; shootout 3–4. [Source](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/germany-paraguay-review-highlights). FIFA search-indexed match report; HTML body unavailable to the reader tool. Individual minutes not independently verified here.
- **Belgium – Senegal, 2026-07-01** — 3–2 after extra time; Belgium recovered from 0–2. [Source](https://www.fifa.com/en/articles/bosnia-england-belgium-usa-review-highlights). FIFA search-indexed review, cross-checked against AP report https://apnews.com/article/461f08dc7297b99741a449cdcbd89ac6 . AP confirms the winning penalty in minute 125; source records 120+5. Other exact goal minutes not independently verified here.

## 规范化修正

旧离线样本 m_82c2b4899a8d-g2-2 原始时刻为 92，原先误作加时。现保留 minute_label=92，将排序字段改为 minute_base=90、minute_added=2、phase=second_half。未改动比分或进球总数；已重算样本缓存。

## 口径与限制

- 比赛进球包含加时，排除点球大战；90+ 补时仍属于 90 分钟口径。乌龙球记受益方。
- 相同基础分钟和补时的事件保留原始顺序，不推测秒数。
- missing/null、0、未参加阶段分别保留；xG、射门、控球、地理坐标未提供，不估计。
- JSON 报告包含逐字段缺失数和源指纹。构建前重跑审计；全量失败阻止构建，加载时重新核验并拒绝错误数据。
- 第三方上传数据采用字段能力判断；其内容真实性未获独立认证。
