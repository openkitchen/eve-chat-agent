# 文件数据工具 POC 测试计划

## 目标

验证 CSV/XLSX 的确定性读取、sandbox CSV 物化、Python 变换，以及受控的下载和图表 artifact。重点是工具边界：后端工具不触发专属 UI；只有 `download_table` 和 `draw_chart` 产生前端 artifact。

## 前置条件

- 后端工具为 `list_attachments`、`inspect_attachment`、`materialize_table`、`query_table` 和 `get_current_time`。
- 前端 artifact 工具为 `download_table` 与 `draw_chart`，二者均使用共享 contracts module 的 Zod schema。
- Eve 默认 `glob` 已禁用。`list_attachments` 是唯一的确定性附件发现入口。
- 前端只为 `download_table` 和 `draw_chart` 的成功、schema 有效输出提供专属 renderer；`materialize_table` 的 `DataRef` 是 sandbox 内部工作数据，不显示其输出。

## Fixtures

| 文件 | 用途 |
| --- | --- |
| `orders.csv` | 单表读取、筛选和显式下载。 |
| `monthly-orders.csv` | Python 按月聚合后绘制单系列趋势。 |
| `regional-revenue.csv` | Python pivot 后绘制同一张多 region 折线图。 |
| `report.xlsx` | 同一 worksheet 内两个候选表的选择流程。 |

`report.xlsx` 是二进制测试基线。测试只读取它；修改 fixture 时必须先审阅二进制 diff。当前 Revenue 候选范围为 `B4:E41`，第二候选范围为 `H4:K8`。

## Happy path

### 1. 发现、检查和查询

1. 上传 `orders.csv`，请求读取或简单聚合。
2. 断言顺序为 `list_attachments -> inspect_attachment -> query_table`。
3. `list_attachments` 输出只包含 attachment ID、文件名、格式和大小；`inspect_attachment` 产生 session-scoped `tableId`、schema、sample 和 profile。
4. `query_table` 只返回确定性 rows/group_by/histogram 结果。它不接受 `view`，不产生表格或图表专属 UI。

### 2. 显式下载

1. 上传 `orders.csv`，请求下载 `status = open` 的 CSV。
2. 断言顺序为 `list_attachments -> inspect_attachment -> download_table`，且不调用 `materialize_table`。
3. 断言 output 包含 `text/csv`、base64 `dataUrl` 和正确 rowCount；前端显示下载操作，但不把 URL 打印到界面。
4. 未请求下载的分析流程不得调用 `download_table`。

### 3. 派生 chart

1. 上传包含长表 region 数据的 CSV，请求把多个 region 放在同一张趋势图。
2. 断言顺序为 `list_attachments -> inspect_attachment -> materialize_table -> draw_chart`。
3. Agent 使用 `materialize_table` 返回的 CSV 与 schema，在 sandbox 运行并检查 Python 脚本，写出 `/workspace/analysis/` 下的宽表，例如 `month,APAC,EMEA,LATAM`。
4. Agent 仅调用一次 `draw_chart`。其 `recharts-cartesian-v1` spec 用 `month` 为 x 轴，并有 APAC、EMEA、LATAM 三个 `line` series。
5. `draw_chart` 验证 CSV 大小、行列上限、series column 存在且为 numeric；成功 output 只含数据、spec 和有限 provenance。前端通过 `DrawChartCard` 渲染 legend、tooltip 和多条线。

### 4. XLSX 候选选择

1. 上传 `report.xlsx`，请求分析但没有指定候选表。
2. 断言 `inspect_attachment` 返回两个稳定候选；Agent 使用 `ask_question`，不在用户选择前调用 `query_table` 或 `materialize_table`。
3. 用户选择后，后续工具只能使用该候选的 `tableId`。

## 自动检查

```bash
npm run typecheck
npm run test:file-artifacts
npm run build:eve
```

Eve eval 使用真实模型，验证工具顺序与关键调用；它不是单元测试的替代品。单元测试必须覆盖 CSV 物化、chart schema 校验、数值 series 拒绝和 CSV 导出公式转义。组件测试必须覆盖 schema 有效的下载/多 series chart、失败回退，以及 `materialize_table` 不显示 sandbox 路径。

## 浏览器检查

在本机上传 fixture 后确认：下载卡只在明确下载时出现；多个 region 在一张图中显示；未知 tool、schema 失败、pending 和 tool error 均回退普通 Tool UI；任何 assistant 文本或专属卡片都不显示 `DataRef.path`。

## 非目标

- PDF/DOCX、OCR、宏、加密/损坏文件、公式重算和 Pivot Table 兼容性。
- SQLite 作为默认数据平面、跨 session artifact 留存、对象存储下载和任意 chart-library props。
- 通过 `dataOperation(DataRef, description)` 让模型解释任意变换；复杂变换在 sandbox 的 Python 中显式完成。
