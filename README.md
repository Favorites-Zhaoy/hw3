# World Cup Data Lab · 世界杯数据实验室

可视化导论 HW3。以“总量与场均排名”“进球时间模式”“球队攻守关联”为主要问题，用 D3 交互图表探索世界杯。真实 pandas 是核心图表的计算依据；纯静态部署，无业务后端。

在线作业：[https://favorites-zhaoy.github.io/hw3/](https://favorites-zhaoy.github.io/hw3/)。

## 本地运行

需要 Node.js 18+（推荐 22）。在本目录打开终端：

```powershell
npm install
npm run dev
```

打开终端显示的地址，默认 http://127.0.0.1:5173/ 。不能直接双击 index.html，因为数据使用 fetch 加载。

```powershell
npm run build
npm run preview
```

`dist/` 可部署至 GitHub Pages 或其他静态托管。Vite 使用相对资源路径，兼容 `/hw3/` 子路径。首次执行 pandas 需要网络下载锁定版本 Pyodide 0.27.2 与 pandas 包；赛事 JSON、D3 和 Three.js 随网站一起打包。运行时加载失败有错误提示、重试、取消与重置入口。

## v2：图表是主角

主要导航为 **赛事可视化 → 数据故事 → 可视化实验室 → 数据与方法**。原有比赛探索与 43 个 pandas 方法领域保留为辅助工具。

- **可视化首页**：总量/场均排名变化图、攻守散点图、四种排行指标、真实进球点阵、阶段 × 时段热力图、时间轴和多指标球队比较。
- **统一计算**：`src/visualAnalysis.mjs` 生成唯一 Python 定义；构建时用真实 pandas 预计算，任意新筛选或强制重算交给浏览器 pandas。缓存使用源数据与执行代码 SHA-256 校验，不能把未执行示例当作计算过程。
- **四个独立数据故事**：排名、进球时间、攻守关联、状态趋势。图表、实际发现、代码与统计解释构成完整阅读路径，窗口滑块让实际 `rolling(3)` 改为 `rolling(4)` 等。
- **可视化实验室**：选择问题后直接查看图表，运行完成后保持图表为默认结果。支持散点、排名变化、状态趋势、柱图、时间线与数值矩阵；数据表、代码与 IR 为辅助视图。12 套分析配方保留。
- **比较与口径**：所有核心图表和比较共用球队、小组、阶段、日期和比分定义。比较进失球、零封和胜场；没有范围内记录的球队不补零。
- **数据与学习**：来源、字段字典、缺失率、JSON 导入导出、原始记录、比赛详情及真实事件时间线；按图表展开 pandas 方法与代码。
- **项目保存**：可移植 JSON 包含原始表、操作、数据来源、SHA-256 指纹、语言、窗口大小与总览筛选。不会写回服务器。
- 中英文、深浅主题、手机适配与键盘入口保留。足球开场缩短到约 1.2 秒，同一会话首次自动出现，可重播。

详见 [改版与验收说明](REVISION.md)。

### 生成真实 pandas 首屏数据

`visual_analysis.json` 随仓库提供，网站与普通 Node 构建不需要本机 Python。改动数据或核心分析定义后重新生成：

```powershell
python -m pip install pandas==2.3.2
npm run data:visuals
npm test
npm run build
```

全量 142 组、离线 60 组常用组合提前计算；其他筛选通过 Worker 计算。GitHub Pages 工作流会运行真实 pandas 预计算再构建，不依赖运行中的后端。

## 数据与指标口径

原始指导文档与 26 场离线种子完整保留在 `worldcup_pandas_data_and_plan/`。开发中已从 [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) 获取并转换全量源：

| 表 | 全量记录 |
| --- | ---: |
| matches | 104 |
| team_matches | 208 |
| goals | 308 |
| teams | 48 |
| venues | 16 |

`public/data/2026/full/manifest.json` 保存获取时间、原始源 SHA-256、表指纹与能力状态。加载器优先读取通过验证的全量版，缺少全量 manifest 时明确回退到 26 场子集。

- 90 分钟比分使用 `ft`；最终比分优先使用 `et`，不计点球大战。
- 胜者在常规 / 加时仍平局时依据点球大战判断。
- 乌龙球记到实际得分方，球员所属队单独记录。
- 45+、90+ 基于基础分钟分桶；无加时比赛中裸写的 92 等时刻解释为下半场补时。
- null 是未提供的值，不等于零。没有射门、xG、控球、传球或追踪数据，不制造战术热图。
- 场地坐标未核实，不画地图。完整基础数据不等于完整高级战术数据；当前未接入首发、换人、注册名单等扩展表。
- 来源为公开社区数据，未独立取得 FIFA 官方认证。

重新获取数据：

```powershell
npm run data:full
# 或使用已下载的来源文件：
node scripts/build-worldcup.mjs --base scripts/upstream-base.json
```

脚本严格检查 104 场、主键唯一、比分、两条球队视角与进球事件数量一致，校验失败不会写入全量 manifest。

## 验证

```powershell
npm run build
# 计算基准测试需要本机 Python 与 pandas；网站运行不需要 Python 安装：
python -m pip install pandas
npm test
```

测试覆盖离线与全量数据、12 套配方、43 个方法示例、5 步跨表分析、错误关联关系、加时、补时、乌龙球、null 和参数引用边界。浏览器已验证真实 Pyodide 聚合、D3 联动、双语页面、项目导入导出与响应式布局。验收记录见 `VALIDATION.md`。

## 源码结构

```text
src/App.tsx              主要/辅助页面、共同筛选与项目保存
src/Exploration.tsx      以图表为主的赛事首页
src/StoryView.tsx        四个完整交互式数据故事
src/VisualCharts.tsx     排名、散点、点阵、状态与多指标比较
src/visualAnalysis.mjs   共用的真实 pandas 分析定义
src/VisualProvider.tsx   校验缓存、状态与在线重算
scripts/precompute-visuals.mjs 构建阶段真实 pandas 预计算
src/Football.tsx         Three.js 足球和球场、飞入开场
src/Charts.tsx           D3 柱图、日期 brush 与矩阵
src/Bracket.tsx          D3 淘汰赛晋级图与缩放
src/Studio.tsx           分析工作台、参数控制和结果视图
src/analysis.mjs         Operation IR 编译与可运行示例
public/pandas-worker.js  浏览器 Python / pandas 运行时
scripts/build-worldcup.mjs 全量来源转换、校验和指纹
tests/analysis.test.mjs  真正 Python pandas 计算基准
```

GitHub Actions 配置包含自动构建验证与手动 GitHub Pages 部署。若部署至 Pages，在仓库 Settings → Pages 选择 GitHub Actions，再手动运行 Deploy Pages。不会因本地开发而自动发布。
