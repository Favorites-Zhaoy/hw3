# World Cup Data Lab · 世界杯数据实验室

可视化导论 HW3。以足球飞向镜头的 3D 开场进入世界杯数据工作台，使用 D3.js 探索赛事，并在浏览器 Web Worker 中使用真实 pandas 计算。纯静态应用，无业务后端。

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

## 功能

- **赛事总览**：3D 足球迎面飞来、重播与跳过开场、比分口径切换、球队排名点击筛选、分钟分桶下钻、日期刷选、分组矩阵、球队比较。
- **分析工作台**：统一 Operation IR → Python 编译 → pandas Worker → DataFrame / D3 图表。支持条件筛选、字段选择、排序、分组聚合、透视、带关系校验的 merge、滚动均值、分桶、缺失审计、去重、类型转换、清洗、melt、描述统计和自定义 Python 节点。可查看代码和 IR、撤销重做、取消执行、下载 Python / 数据 / 图表 SVG。
- **数据实验室**：来源、字段字典、缺失率、分页搜索排序、JSON 导入与导出；上传 JSON 支持对象数组或标准 `{rows: [...]}`。
- **比赛探索**：比赛卡片、搜索、阶段筛选、真实进球事件时间线与可缩放的 D3 淘汰赛晋级图。
- **分析故事**：12 套可运行分析配方，可在工作台调整并复现。
- **pandas 方法图谱**：43 个方法领域，每个有实际运行示例。部分通过可视化节点实现，其他通过明确标注不可逆的 Python 代码节点实现；不声称覆盖整个 pandas API。
- **项目保存**：可移植 JSON 包含原始表、操作、数据来源、SHA-256 指纹、语言和总览筛选；导入时校验指纹。浏览器会话数据通过下载保存，不写回服务器。
- 中英文界面、深浅主题、手机适配、键盘操作、尊重减少动态效果设置、WebGL 不可用时显示静态足球。

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
src/App.tsx              六个页面、联动状态与项目持久化
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
