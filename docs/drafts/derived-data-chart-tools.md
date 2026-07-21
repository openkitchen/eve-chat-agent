# 临时设计：Sandbox 数据 I/O 与前端导向 Chart Tool

> 状态：讨论草案，尚未进入实现。
>
> 本文依据 `wrun_01KY19ZW36E31CKK2043YAG0R5` 更新。它只描述当前 POC 的最小工具边界，不引入通用 data-operation DSL、跨 session 数据血缘或完整图表语法。

## 结论

文件分析链路中的工具分为两类：

1. **后端执行型工具**：只在 Eve app runtime 或 sandbox 执行，结果主要服务于后续 Agent 步骤；UI 没有专属 artifact renderer。
2. **前端 artifact 工具**：仍由后端执行，但返回稳定的 JSON payload；浏览器按 `toolName + output schema` 使用专属 renderer 呈现下载文件、图表等用户可见结果。

所有 Eve authored tools 都只在后端执行。前端不是 tool 的第二个 executor，而是前端 artifact tool 输出的确定性 renderer。

本 POC 的最小目标是：

```text
inspect attachment
  -> materialize_table
  -> AI uses Python to read/write sandbox data files
  -> draw_chart
  -> Recharts renderer in browser
```

数据转换由 AI 的 Python 脚本完成。`draw_chart` 不承担业务转换、pivot 或 aggregate；它读取已经被 Python 整理成 UI 期望形状的 CSV，解析并发送 `{ data, spec }` 给浏览器。

## 这次 session 暴露的问题

源数据是长表：

| month | region | revenue | target |
| --- | --- | ---: | ---: |
| 2026-01 | APAC | 120 | 100 |
| 2026-01 | EMEA | 100 | 90 |
| 2026-01 | LATAM | 80 | 75 |

当前 `publish_derived_chart` 只接受一个 `x` 和一个 `y`。前端也只渲染一个 `<Line dataKey={view.y}>`，所以 Agent 即使产出了 APAC、EMEA、LATAM 三列，也只能选其中一列；最后产生了多张单 region 图。

正确做法是让 Python 生成前端 chart-ready 宽表：

```csv
month,APAC,EMEA,LATAM
2026-01,120,100,80
2026-02,150,110,85
```

然后一次 `draw_chart` 返回三条 series 的图表 payload。这样，数据 shape 的决定权在 Python/data preparation，图表 props 的决定权在 UI renderer，而不是在后端另造一套 chart language。

## 当前前端基础

当前前端使用 **Recharts 3.9.2**。现有 [`ChartPlot`](../../app/_components/chart-card.tsx) 已经使用：

```tsx
<LineChart data={data}>
  <CartesianGrid />
  <XAxis dataKey={xKey} />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line dataKey="APAC" />
  <Line dataKey="EMEA" />
  <Line dataKey="LATAM" />
</LineChart>
```

Recharts 本身有完整 React API，包括 callback、React element、自定义 tooltip、任意 CSS 和自定义 shape。这些内容不能作为 AI tool 的 JSON input。目标不是 JSON 化完整 Recharts props，而是由 **frontend renderer 定义一个可序列化、可验证、与 Recharts 结构接近的子集**。

这个子集的 source of truth 是前端 renderer；shared contract 仅供 renderer、后端 `draw_chart` tool 和测试共同 import，不能由后端单方面发明字段。

## 基础数据句柄：`DataRef`

本 POC 的 `DataRef` 保持简单：它是 AI 在 sandbox 内可操作的数据文件及其基本 schema。第一版以 CSV 实现，但工具名和概念不绑定 CSV。

```ts
type Column = {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "mixed";
};

type DataRef = {
  path: string;       // sandbox-only path; never shown in user-facing prose/UI
  format: "csv";     // first implementation; extend later if needed
  schema: Column[];
};
```

示例：

```json
{
  "path": "/workspace/analysis/input/report_revenue.csv",
  "format": "csv",
  "schema": [
    { "name": "month", "type": "number" },
    { "name": "region", "type": "string" },
    { "name": "revenue", "type": "number" },
    { "name": "target", "type": "number" }
  ]
}
```

`DataRef.path` 是给当前 Agent/sandbox 的工作引用，不是浏览器 URL、下载 URL 或跨 session identifier。`draw_chart` 必须限制它只能读取允许的 sandbox 目录及支持的文件格式，并在读入时重新解析和校验 CSV；输入中的 schema 只是给 AI 的 planning hint，不是权威数据。

## 工具分类与重命名

### 目标工具表

| 期望工具 | 类型 | 调用时机 | 后端职责 | 前端专属呈现 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| `list_attachments` | 后端/I-O | 开始处理上传文件 | 列出 session 内支持的 CSV/XLSX 附件 | 无 | 当前 `glob`，应改名 |
| `inspect_attachment` | 后端/I-O | 选择附件后 | 解析表候选，返回 schema/sample/profile，登记 `tableId` | 无 | 保留 |
| `materialize_table` | 后端/I-O | AI 要用 Python 操作已检视表时 | 将 `tableId` 写入受限 sandbox 数据文件，返回 `DataRef` | 无 | 新增 |
| `query_table` | 后端/确定性读取 | 简单读取或聚合足以回答时 | 对 `tableId` 执行受限 rows/group/histogram 查询 | 无 | 保留，但移除 `view` |
| `download_table` | 前端 artifact | 用户明确要求下载 CSV/JSON 时 | 生成 bounded download payload | `DownloadFileCard` | 当前 `export_table`，应改名 |
| `draw_chart` | 前端 artifact | 用户明确需要图表时 | 解析 chart-ready `DataRef`，验证并返回 chart payload | `DrawChartRenderer` | 替换 `publish_derived_chart` |
| `get_current_time` | 后端 | 查询时间时 | 返回指定时区当前时间 | 无 | 保留，和文件链路无关 |

Eve 的 `bash`、`read_file`、`write_file`、`grep` 是已存在的基础 sandbox 工具。复杂转换继续由 Agent 的 Python 脚本完成，不需要为每一种转换发明新 tool。

### 现有工具的具体修正

| 当前名 | 当前行为 | 问题 | 目标 |
| --- | --- | --- | --- |
| `glob` | 实际只列附件，返回 `attachmentId` | 名称暗示任意 sandbox glob | 改为 `list_attachments` |
| `query_table` | 查询结果可带 `view`，前端可能渲染 table/chart | 一个后端查询 tool 同时决定 UI 呈现 | 保留查询；去除 `view` 和专属 chart/table renderer 责任 |
| `export_table` | 返回 `dataUrl`，UI 显示下载卡片；同时写入 sandbox artifact | 名称容易被 AI 当成内部 CSV materialization | 改为 `download_table`；只允许用户明确下载时调用 |
| `publish_derived_chart` | 从 `/workspace/analysis` 读取 CSV，同时 parse、validate、定义单序列 view、触发 renderer | 混合数据读取和 UI chart，且不能多 series | 替换为 `draw_chart` |

`download_table` 不可用于 AI 的中间数据。当前提示词虽有“仅用户请求下载时使用”的规则，但这只是 prompt 约束；重命名和分离 `materialize_table` 后，tool 的能力边界才清晰。

## `materialize_table`

```ts
materialize_table({ tableId }): DataRef
```

它只做一次受控 I/O：从 `inspect_attachment` 已登记的 table 读取规范化 rows，写到固定允许目录，并返回该文件的 `DataRef`。第一版输出 CSV；未来若需 JSON/SQLite/Parquet，可扩展 `format` 和 writer，调用方名称不变。

它不：

- 下载文件给用户；
- 显示专属 UI；
- 对业务数据做 transform；
- 接受任意输入路径或任意 SQL；
- 替代 `query_table` 的确定性聚合。

Agent 获得 ref 后可以使用 Python 读取 CSV、按真实用户意图转换并写入新的 `/workspace/analysis/*.csv`。它应检查自己的输出；生成图时，把该派生 CSV 作为 `draw_chart` source。

## UI-first `draw_chart` contract

### 输入

```ts
type DrawChartInput = {
  source: DataRef;
  spec: RechartsCartesianSpec;
};
```

`RechartsCartesianSpec` 是 renderer-owned shared contract。第一版仅实现当前前端已具备的 Cartesian line/bar 能力；字段结构刻意贴近 React component tree：chart、axes、series、grid、legend、tooltip。

```ts
type RechartsCartesianSpec = {
  renderer: "recharts-cartesian-v1";

  chart: {
    type: "line" | "bar";
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
  };

  xAxis: {
    dataKey: string;
    type?: "category" | "number";
    label?: string;
    interval?: "auto" | "preserveStartEnd";
  };

  yAxes?: Array<{
    id: "left" | "right";
    label?: string;
    scale?: "linear" | "log";
    domain?: "auto" | "zeroToDataMax" | [number, number];
  }>;

  series: Array<{
    type: "line" | "bar";
    dataKey: string;
    name?: string;
    yAxisId?: "left" | "right";
    stackId?: string;
    color?: string;
    strokeWidth?: 1 | 2 | 3;
    dot?: boolean;
  }>;

  grid?: { show: boolean };
  legend?: { show: boolean; verticalAlign?: "top" | "bottom" };
  tooltip?: { show: boolean; shared?: boolean };
};
```

这个结构不接受 React component、callback/function、任意 CSS、custom shape、任意 formatter 或任意 Recharts prop。它们不适合从模型经 JSON 传输到浏览器。新增视觉能力时，顺序必须是：先修改前端 renderer 和测试，再扩 shared spec，最后让 `draw_chart` input schema 接受新字段。

### 本次多 region 折线图

Python 先产生宽表：

```csv
month,APAC,EMEA,LATAM
2026-01,120,100,80
2026-02,150,110,85
```

然后 Agent 调用：

```json
{
  "source": {
    "path": "/workspace/analysis/monthly_revenue_by_region.csv",
    "format": "csv",
    "schema": [
      { "name": "month", "type": "date" },
      { "name": "APAC", "type": "number" },
      { "name": "EMEA", "type": "number" },
      { "name": "LATAM", "type": "number" }
    ]
  },
  "spec": {
    "renderer": "recharts-cartesian-v1",
    "chart": { "type": "line" },
    "xAxis": { "dataKey": "month", "type": "category" },
    "series": [
      { "type": "line", "dataKey": "APAC", "name": "APAC" },
      { "type": "line", "dataKey": "EMEA", "name": "EMEA" },
      { "type": "line", "dataKey": "LATAM", "name": "LATAM" }
    ],
    "grid": { "show": true },
    "legend": { "show": true, "verticalAlign": "bottom" },
    "tooltip": { "show": true, "shared": true }
  }
}
```

### 后端输出和前端映射

`draw_chart` 后端执行以下有限工作：

1. 验证 source path 在允许目录，格式受支持。
2. 解析 CSV，重新推断/验证 schema。
3. 验证 `xAxis.dataKey` 和全部 `series[].dataKey` 存在，且 series 是 numeric。
4. 执行 row、column、byte 和 series 数量限制；不静默截断。
5. 返回 UI payload，不返回 sandbox path。

```ts
type DrawChartOutput = {
  data: Array<Record<string, string | number | boolean | null>>;
  spec: RechartsCartesianSpec;
  provenance: {
    kind: "sandbox-derived" | "materialized-table";
    rowCount: number;
  };
};
```

`DrawChartRenderer` 只需把 payload 映射到 Recharts：

```tsx
<LineChart data={output.data} margin={output.spec.chart.margin}>
  <CartesianGrid hide={!output.spec.grid?.show} />
  <XAxis {...output.spec.xAxis} />
  <YAxis yAxisId="left" />
  {output.spec.tooltip?.show && <Tooltip shared={output.spec.tooltip.shared} />}
  {output.spec.legend?.show && <Legend verticalAlign={output.spec.legend.verticalAlign} />}
  {output.spec.series.map((series) => (
    <Line key={series.dataKey} {...series} />
  ))}
</LineChart>
```

实际 renderer 会按 `chart.type` 选择 `LineChart` / `BarChart`，并按 `series.type` 选择 `Line` / `Bar`。这个映射由前端拥有；后端不导入 Recharts，也不产生 JSX。

## 可扩展性边界

`recharts-cartesian-v1` 的初始支持集是：多 series line、multi-series/stacked bar、grid、legend、tooltip、最多两条 Y axis。它足以覆盖当前 use case，也与 Recharts 的现有组件组织一致。

未来可以增加，但应是新的前端能力先行：

| 需求 | 演进方式 |
| --- | --- |
| area / line + bar 混合图 | renderer 加 `AreaChart` / `ComposedChart` 后扩 `chart.type` 和 `series.type` |
| reference line/area | renderer 支持后新增受限 `references` 数组 |
| pie/radar/scatter | 新 renderer family，例如 `recharts-polar-v1`，不污染 Cartesian spec |
| 自定义 tooltip/formatter/shape | 由前端预置 enum/preset，不接受模型传入 function 或 JSX |
| 复杂业务 aggregate/pivot | 仍在 Python/data preparation 层完成，不放入 chart spec |

“不失去功能”应理解为：不失去本产品承诺的可视化能力，而不是不失去 Recharts 的全部 React API。后者既不可安全序列化，也不利于稳定升级。

## 端到端流程

```text
User: "在一张图中比较每个 region 的月度收入"

list_attachments
  -> inspect_attachment
  -> materialize_table(tableId)
  -> DataRef for source CSV
  -> Python reads source CSV and writes monthly_revenue_by_region.csv
  -> draw_chart({ source: derived DataRef, spec })
  -> DrawChartOutput through Eve action.result
  -> DrawChartRenderer renders one Recharts chart with three lines
  -> Agent writes textual interpretation
```

下载是另一个独立流程：

```text
User: "下载 APAC 的明细 CSV"
  -> inspect_attachment
  -> download_table(tableId, query, "csv")
  -> DownloadFileCard
```

Agent 不得为了内部 Python 输入调用 `download_table`，也不得为了下载而调用 `materialize_table`。

## Subagents

当前无需用 subagent 解决数据 I/O 或画图。Eve 子 agent 有 fresh `defineState`，declared subagent 还有独立 sandbox；它们不适合隐式共享当前 session 的表或工作文件。

当工具边界稳定后，subagent 可用于独立的 planning/review：给定 schema 和用户意图，建议 Python transform 或 `RechartsCartesianSpec`，但不读写主 sandbox 文件，也不执行 `draw_chart`。

## 验收条件

1. 用户请求复杂分析时，Agent 使用 `materialize_table` 后的 `DataRef` 作为 Python 输入，不重抄表中数据。
2. 用户未要求下载时，Agent 不调用 `download_table`，UI 不出现下载卡片。
3. 用户请求多 region 趋势时，Python 生成一个宽表 CSV，Agent 只调用一次 `draw_chart`。
4. `DrawChartRenderer` 根据同一个 `RechartsCartesianSpec` 创建 APAC、EMEA、LATAM 三个 `Line`，并显示 legend/tooltip。
5. `draw_chart` 拒绝不允许的 path、缺失 column、非 numeric series、超过上限的 CSV 和不支持的 renderer/spec version。
6. 浏览器不会收到 sandbox path；只有 `data`、`spec` 和有限 provenance 进入 tool result。

## Concept Delta（Governance）

### Reused canonical terms

当前没有可复用的 canonical terms。本文复用以下已登记但仍为 `proposed` 的术语：

| term | usage in this doc | source/evidence |
| --- | --- | --- |
| `Temporary Data` | 当前 session 的 CSV、tool result 和下载 artifact | `references/glossary.md` |
| `Structured Business Data` | CSV/XLSX 表中的业务事实和输入 | `references/glossary.md` |
| `Capability` | 后端执行型与前端 artifact 工具的能力边界 | `references/glossary.md` |

### Newly proposed / working terms

| candidate_term | type | rationale | overlaps_with | intended_scope | owner | target_decision_date | escalation_trigger | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DataRef` | technical | 当前 Agent 可操作的 sandbox 数据文件和 basic schema | `Temporary Data` | file-artifacts POC | Architecture Working Group | TBD | 对外 API 或跨 session 使用前 | proposed |
| `frontend artifact tool` | technical | 后端返回固定 UI payload、前端有专属 renderer 的工具类别 | `Capability Contract` | file-artifacts UI | Architecture Working Group | TBD | 跨 agent/UI 复用前 | proposed |
| `RechartsCartesianSpec` | technical | Recharts Cartesian renderer 的安全可序列化 props 子集 | `Capability Contract` | file-artifacts chart UI | Architecture Working Group | TBD | 增加第二 renderer family 前 | proposed |

### Deprecated aliases touched

| alias | replacement | where touched | action |
| --- | --- | --- |
| `glob` for attachment listing | `list_attachments` | 当前 file tool | rename when implemented |
| `export_table` for user download | `download_table` | 当前 file tool | rename when implemented |
| `publish_derived_chart` | `draw_chart` | 当前 file tool | replace when implemented |

### Decision links

- `references/concept-governance.md`
- `references/glossary.md`
- `references/concepts/agent-platform.md`
- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`

### Governance completeness verdict

- `BLOCKED`
- Reason: 既有相关术语与本次 working terms 均未获 owner 批准；本文只用于 POC 设计讨论，不能据此固化平台 canonical API 或术语。

## 参考依据

- Eve bundled docs, `tools/overview.mdx`：authored tool 在 app runtime 执行，tool output 可作为 `action.result` 交给 channel renderer。
- Eve bundled docs, `guides/frontend/overview.mdx`：`useEveAgent()` 将 tool result 投影为前端可渲染的 dynamic-tool part。
- Recharts 3.9.2, [LineChart API](https://recharts.github.io/en-US/api/LineChart/) 和 [Line API](https://recharts.github.io/en-US/api/Line/)：当前 renderer 使用的 Cartesian chart/component 模型。
- SQLite, [Appropriate Uses For SQLite](https://sqlite.org/whentouse.html)：未来若选用 SQLite 作为 sandbox 临时计算格式时的 local/temporary storage 边界。
