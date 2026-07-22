# 文件数据工具 POC 设计

## 目的

本 POC 让 Agent 处理上传的 CSV/XLSX，同时把三类职责分开：确定性表读取、sandbox 内的数据变换，以及受控的前端 artifact。复杂数据变换不由一个“大而全”的工具承担，而由 Agent 在当前 sandbox 的 Python 中完成。

当前设计讨论和迁移理由见 [derived-data-chart-tools.md](../drafts/derived-data-chart-tools.md)。本文描述已实现的契约。

## 工具分类

| 工具 | 类别 | 输入 | 结果 | 专属 UI |
| --- | --- | --- | --- | --- |
| `list_attachments` | 后端 I/O | 无 | session 支持的 CSV/XLSX attachment refs | 无 |
| `inspect_attachment` | 后端 I/O | attachment ID | 表候选、schema、sample、profile | 无 |
| `materialize_table` | 后端 I/O | table ID | sandbox CSV `DataRef` | 无 |
| `query_table` | 后端查询 | table ID、受限 query | 受限 rows/group_by/histogram | 无 |
| `download_table` | 前端 artifact | table ID、下载 query、格式 | download payload | `DownloadFileCard` |
| `draw_chart` | 前端 artifact | chart-ready `DataRef`、chart spec | chart data、spec、provenance | `DrawChartCard` |
| `get_current_time` | 后端 | 无 | 当前时间 | 无 |

`glob` 是 Eve 默认工具，已通过 `agent/tools/glob.ts` 的 `disableTool()` 禁用。它不再是附件工具的别名。

## 数据流

```text
Browser upload
  -> /workspace/attachments/...
  -> list_attachments -> inspect_attachment
  -> session table state (tableId, normalized rows, schema)
  -> materialize_table
  -> DataRef (/workspace/analysis/input/<tableId>.csv, csv, schema)
  -> Python/Bash transformation in the current sandbox
  -> derived DataRef under /workspace/analysis/
  -> draw_chart -> { data, spec, provenance }
  -> browser DrawChartCard -> Recharts
```

`DataRef` 是当前 session 的模型工作引用：

```ts
type DataRef = {
  path: "/workspace/analysis/input/table_abc.csv";
  format: "csv";
  schema: [
    { name: "month", type: "date" },
    { name: "APAC", type: "number" },
    { name: "EMEA", type: "number" },
  ];
};
```

它不是用户下载，也不是持久数据库记录。`materialize_table` 的完整 tool output 由前端标记为已处理但不渲染，避免在聊天 UI 中显示 sandbox 路径。assistant prose 同样不得显示路径或 `dataUrl`。

## 处理规则

1. 处理附件时，Agent 先调用 `list_attachments`，之后只使用该 session 返回的 attachment ID。
2. `inspect_attachment` 是生成 `tableId` 的唯一入口。多附件或多候选且都可能回答问题时，Agent 必须先调用 `ask_question`。
3. `query_table` 只负责受限确定性查询，不再接受 `view` 或决定 UI 呈现。
4. 需要复杂变换时，Agent 先调用 `materialize_table`，再使用 Python 标准库读写 CSV。不得把数据重抄进 prompt，也不得把 `download_table` 作为内部物化。
5. `download_table` 只用于用户明确请求 CSV/JSON 下载。它在 tool output 中提供受限 data URL；浏览器用它创建下载操作。
6. `draw_chart` 只读取 `/workspace/analysis/` 下安全 CSV，并重新解析、校验 CSV 和 spec。它不做业务聚合或 pivot。

## `draw_chart` 契约

图表数据应尽量接近当前 Recharts renderer 的需求。第一版只支持 Cartesian `line` 和 `bar`，接受受控 `recharts-cartesian-v1` 子集，不接受完整 Recharts props、JSX、callback/function、任意 CSS 或 HTML/SVG/JavaScript。pie、donut、area、scatter、radar 和 mixed chart 均不支持；Agent 必须直接说明限制，不得通过 Python 或 sandbox 文件模拟这些图表。

```ts
const source: DataRef = {
  path: "/workspace/analysis/monthly-by-region.csv",
  format: "csv",
  schema: [
    { name: "month", type: "date" },
    { name: "APAC", type: "number" },
    { name: "EMEA", type: "number" },
    { name: "LATAM", type: "number" },
  ],
};

const spec = {
  renderer: "recharts-cartesian-v1",
  title: "Monthly revenue by region",
  chart: { type: "line" },
  xAxis: { dataKey: "month" },
  grid: { show: true },
  legend: { show: true },
  tooltip: { show: true },
  series: [
    { type: "line", dataKey: "APAC", name: "APAC" },
    { type: "line", dataKey: "EMEA", name: "EMEA" },
    { type: "line", dataKey: "LATAM", name: "LATAM" },
  ],
} as const;
```

后端限制 chart CSV 至 64 KiB、50 行、20 列，并要求 x column 和所有 series column 存在，且 series 为 number 类型。`chart.type` 与每个 series 的 type 必须一致。输出只包含 `{ data, spec, provenance }`，不返回 source path。

前端 `DrawChartCard` 根据同一 spec 直接映射为 Recharts 的 `LineChart`/`BarChart`、`XAxis`、至多两个 `YAxis`、`Line`/`Bar`、grid、legend 和 tooltip。多 region 的每个宽表数值列对应一个 `Line`；不得拆成多个 chart tool call。

## UI 边界

Eve 将 authored tool 的完整 JSON result 作为 dynamic-tool part 交给 UI。前端先按 `toolName` 用 Zod `safeParse` 验证：

- `download_table`：渲染 `DownloadFileCard`，并隐藏原始 data URL。
- `draw_chart`：渲染 `DrawChartCard`。
- `materialize_table`：标记为已处理，抑制通用输出，避免展示 sandbox path。
- 所有其他工具，以及 schema 失败、pending、拒绝或 error：显示普通 Tool UI。

这里的“前端 artifact 工具”表示有专属 renderer 的 tool；不改变其后端执行方式。所有工具都由 Eve 应用运行时执行。

## 边界与非目标

- 第一版的共享工作格式是 CSV，不引入 SQLite data plane。MicroSandbox 已具备 Python 标准库 `sqlite3`，但仅在某个分析明确需要本地关系计算时由 Agent 脚本使用。
- 不提供 `dataOperation(DataRef, description)`。自然语言变换会把执行语义和验证边界交还给模型；本 POC 使用可检查的 Python/Bash 脚本和明确的 CSV 输入/输出。
- 不引入 subagent 处理当前 session 的表或 sandbox 文件。子 agent 有独立 state/sandbox，无法隐式共享该数据。
- 不支持 pie、donut、area、scatter、radar、mixed chart、任意图表库 options、跨 session artifact 存储、对象存储下载或用户可执行脚本。

## 验收条件

1. `export_table`、`publish_derived_chart` 和受限 `glob` wrapper 不再被发现为可调用工具。
2. 不请求下载的分析不会产生下载卡片。
3. 多 region 请求使用一个宽表和一次 `draw_chart`，在同一图中渲染多条线。
4. `draw_chart` 的无效 source path、缺失 column、非数值 series、超过上限 CSV 或不支持 renderer/spec 均在后端失败。
5. 只有 schema 有效的 `download_table` 和 `draw_chart` output 使用专属 UI。

## Concept Delta（Governance）

### Reused canonical terms

当前没有可复用的 canonical terms。`Temporary Data`、`Structured Business Data` 和 `Capability` 在 [glossary](../../references/glossary.md) 中仍为 `proposed`。

### Newly proposed / working terms

| candidate_term | type | rationale | overlaps_with | intended_scope | owner | target_decision_date | escalation_trigger | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DataRef` | technical | 当前 Agent 可操作的 sandbox CSV 和 basic schema | `Temporary Data` | file-artifacts POC | Architecture Working Group | TBD | 对外 API 或跨 session 使用前 | proposed |
| `frontend artifact tool` | technical | 后端返回固定 UI payload、前端有专属 renderer 的工具类别 | `Capability Contract` | file-artifacts UI | Architecture Working Group | TBD | 跨 agent/UI 复用前 | proposed |
| `RechartsCartesianSpec` | technical | Recharts Cartesian renderer 的安全可序列化 props 子集 | `Capability Contract` | file-artifacts chart UI | Architecture Working Group | TBD | 增加第二 renderer family 前 | proposed |

### Deprecated aliases touched

| alias | replacement | where touched | action |
| --- | --- | --- | --- |
| `glob` for attachment listing | `list_attachments` | file tool | replaced |
| `export_table` | `download_table` | file tool | replaced |
| `publish_derived_chart` | `draw_chart` | file tool | replaced |

### Decision links

- `references/concept-governance.md`
- `references/glossary.md`
- `references/concepts/agent-platform.md`
- `references/concept-decisions/2026-07-19-information-context-vocabulary.md`

### Governance completeness verdict

- `BLOCKED`
- Reason: 上述工作术语及相关既有术语仍未获 owner 批准；本文不将它们固化为跨平台 canonical API 或术语。
