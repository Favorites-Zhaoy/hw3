# World Cup × pandas — 数据与详细方案交付包

这不是完整的网站源码；本交付包含一套**可直接放到静态网站 `public/data/` 下使用的 JSON 数据**、一个完整的中文 Markdown 方案文档，以及一次性构建 2026 世界杯完整 JSON 数据的工具。数据转换脚本仅在本机或 CI **构建期间执行**，上线网站不需要后端。

## 已提供（可离线使用）

- `public/data/2026/matches.json` — **26 场真实比赛的子集**，不是完整 104 场
- `public/data/2026/team_matches.json` — 52 条球队-比赛视角记录
- `public/data/2026/goals.json` — 78 条进球事件
- `public/data/2026/teams.json` — 涉及的 18 支球队
- `public/data/2026/venues.json` — 15 个场地
- `public/data/2026/manifest.json` — 数据状态、可用表、来源路径
- `public/data/2026/data_dictionary.json` — 中英双语字段数据字典
- `public/data/2026/pandas_atlas.json` — 43 个 pandas 可视化操作主题
- `public/data/2026/analysis_recipes.json` — 12 套可视化分析模板
- `public/data/2026/visualization_presets.json` — 11 种图表预设
- `public/locales/zh-CN.json`、`en-US.json` — 82 个一一对应的首批双语 UI 资源键
- `public/data/2026/table.schema.json` — JSON 数据表结构约束
- `public/data/2026/example_project.json` — 可视化分析项目 JSON 示例
- `public/data/2026/cleaning_practice_synthetic.json` — **虚构的**数据清洗练习，不能当作世界杯实况统计
- `public/data/2026/sources.json`、`diagnostics.json` — 来源与质量数据

> 离线快照按 2026-10-14 所查看的 openfootball 公开 JSON 资料整理。小组 A/B/C 的 18 场 + 后期 8 场淘汰赛。准确性声明仅限于与该公开数据源核对，不表示 FIFA 官方独立认证。

## 完整 104 场：一次性生成纯静态 JSON

如果开发/部署环境能够访问 `raw.githubusercontent.com`，运行：

```bash
node scripts/build-worldcup.mjs
```

结果输出到 `public/data/2026/full/`，预期生成 `matches=104`、`team_matches=208`，以及从实际来源提取出的 `goals, teams, venues, players, lineups, substitutions, bookings, referees, shootouts` 等静态 JSON。将这些 JSON 与网站一起部署，**运行时不用任何后端**。

如果网络不便，可以手动从以下 URL 下载三个 JSON，再执行：

- https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
- https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup-full.json
- https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.squads.json

```bash
node scripts/build-worldcup.mjs \
  --base ./downloaded/worldcup.json \
  --details ./downloaded/worldcup-full.json \
  --squads ./downloaded/worldcup.squads.json
```

Node.js 要求 18+。`--details` 与 `--squads` 是可选增强源，缺失时对应高级 JSON 表为空；`--base` 必须可用且恰好 104 场，否则**不会输出错误的“完整数据”**。本交付环境无法直接访问外部文件下载服务，因此只附带已核对的离线子集和可再生成完整版的构建工具，未声称随包含 104 场完整数据。

## 开发预览数据

可以在项目根目录运行一个普通的静态文件服务器，仅用于本地开发查看文件，不是业务后端：

```bash
python -m http.server 8080 --directory public
```

打开 `http://localhost:8080/data/2026/manifest.json` 查看数据清单。

## 文件格式

每个标准数据表都有四部分：

```json
{
  "schema_version": "1.0.0",
  "dataset_id": "fifa-world-cup-2026-offline-seed",
  "table": "matches",
  "meta": {"row_count": 26},
  "rows": []
}
```

浏览器通过 `fetch()` 获取 JSON 后对 `rows` 建立表格和图表；Pyodide 在浏览器 Web Worker 中读取相同 JSON 并执行真正的 pandas。用户修改的数据只能导出新的 JSON 文件，静态网站不能直接写回部署服务器上的 JSON。

## 详细方案

请阅读根目录 **`世界杯与pandas可视化分析平台-详细实施方案.md`**。

主要包括：数据字典与指标口径、视觉交互、43 个 pandas 功能映射、12 套分析案例、无后端 Pyodide 架构、统一操作 JSON 协议、完整的双语设计、测试与分阶段验收。
