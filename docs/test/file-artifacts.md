# 文件数据视图 POC 测试计划

## 目标

以 CSV/XLSX 的 happy path 为主，并确认职责边界：工具返回确定性数据，Agent 做选择和图表决策，前端渲染受控 JSON。另保留少量防回归检查：超限输入必须在持久化前失败、CSV 导出必须转义公式前缀。此计划不追求 parser 覆盖率或安全压测。

## 前置条件

- 工具已实现为 `inspect_attachment`、`query_table`、`export_table`、`publish_derived_chart`，并使用设计文档的 schema。
- `agent/instructions.md` 已纳入文件处理 Prompt 规则。
- Web UI 已为受控 `query_table` / `export_table` / `publish_derived_chart` 输出提供专用 renderer。
- Eve sidecar、Next.js UI 都在本机运行；使用实际浏览器上传 fixture。

## Fixtures

| 文件 | 内容 |
| --- | --- |
| `test/fixtures/file-artifacts/orders.csv` | 表头为 `order_id,amount,status,created_at`；数据为 `o-001,120.5,open,2026-01-01`、`o-002,88,closed,2026-01-02`、`o-003,240,open,2026-01-03`。 |
| `test/fixtures/file-artifacts/monthly-orders.csv` | 表头为 `created_at,amount`；数据为 `2026-01-05,12`、`2026-01-20,8`、`2026-02-10,18`、`2026-02-15,2`。用于验证 sandbox 派生月度数据与 chart artifact。 |
| `test/fixtures/file-artifacts/report.xlsx` | 一个 worksheet：B4=`Revenue`；B5:E5=`month,region,revenue,target`；B6:E9 为 `2026-01,APAC,120,100`、`2026-02,APAC,150,120`、`2026-03,EMEA,90,95`、`2026-04,EMEA,210,180`。H4=`Costs`；H5:K5=`category,budget,actual,variance`；H6:K8 为 `Infrastructure,80,70,-10`、`Payroll,120,130,10`、`Marketing,40,35,-5`。F:G 必须完全为空。 |

不需要外部提供 XLSX。实现时新增 `scripts/create-file-artifacts-fixtures.mjs`，用 `exceljs` 写入上述固定单元格，并用 Node `fs` 同时写入 `orders.csv`。在 `package.json` 新增：

```bash
npm run fixtures:file-artifacts
```

该命令生成并覆盖两个 fixture；生成后的 CSV/XLSX 作为测试基线提交进仓库。更新 fixture 时先改本表的固定数据，再运行命令并审阅二进制 diff；Eve eval 与浏览器测试只读取已提交的 fixture，不在运行中随机生成。

## Happy path

### 1. 单表 CSV 查询和图表

1. 上传 `orders.csv`，发送“按日期展示订单金额趋势”。
2. 断言 Agent 先调用受限 `glob`，再以该次输出中的 `attachmentId` 调用 `inspect_attachment`；glob output 不含 sandbox path。inspect 输出仅有一个 candidate，含实际 `tableId`、CSV range、列类型、样本、空值与数值范围。
3. 断言 Agent 选择该 candidate，调用 `query_table`：`query.type = "rows"`、`view.kind = "line"`、`x = "created_at"`、`y = "amount"`。
4. 断言工具返回的 `view` 与输入相同、`resultColumns` 和 rows 含 `created_at`/`amount`、ordering 为 `source-row`，且前端显示 line chart card 和来源表信息。

聊天输入框的回形针按钮只接受一个不超过 10 MiB 的 CSV/XLSX；选中后显示文件名和移除按钮，也可把文件拖入输入框区域。

### 2. 偏移且多表的 XLSX 选择

1. 上传 `report.xlsx`，发送“看看这个报告”。
2. 断言 `inspect_attachment` 返回同一 sheet 的两个候选，range 分别为 `B4:E9` 和 `H4:K8`，且顺序稳定。
3. 断言 Agent 调用 `ask_question`，而不是在没有用户选择的情况下调用 `query_table`。选择项显示 sheet、range 和 headers。
4. 用户选择 Revenue 表。
5. 断言后续 `query_table.tableId` 等于所选 candidate 的 `tableId`，且 table card 只显示该区域的数据。

### 3. 筛选后导出 CSV

1. 上传 `orders.csv`，发送“导出所有 status 为 open 的订单 CSV”。
2. 断言 Agent inspect 后调用 `export_table`，其 `query.type = "rows"` 且 `filter = { column: "status", equals: "open" }`。
3. 断言工具输出 `mediaType = "text/csv"`、非空 base64 `dataUrl`、`rowCount = 2`，没有泄漏 sandbox 路径或 `truncated` 字段。
4. 点击下载卡片，断言下载文件只含 `open` 行及请求列，文件名带 `.csv`。

### 4. Sandbox 派生月度折线图

1. 上传 `orders.csv`，发送“按月汇总金额并画图”。
2. 断言 Agent 仍先调用 `glob` 和 `inspect_attachment`。`query_table` 无法完成按月 bucket 时，Agent 在当前 sandbox 的 `/workspace/analysis/` 写入、读取并检查带 `month,total_amount` header 的 CSV。
3. 断言 Agent 调用 `publish_derived_chart`，其 input 只有安全 CSV basename、inspect 返回的 `sourceTableId` 与 `view = { type: "chart", kind: "line", x: "month", y: "total_amount" }`；不提交 rows 或 sandbox path。
4. 断言 tool output 的 `rows` 为汇总后的月度数值，`provenance.sourceTable` 指向已 inspect 的表，`truncated = false`；前端显示 line chart card 与 sandbox-derived 来源说明，不显示 ASCII/Markdown 模拟图。

## 每个用例的共通检查

- Agent 不伪造 attachment ID、`tableId`、sheet、range、column 或数据值；用户提问有歧义时使用 `ask_question`。
- `query_table` 拒绝未知 column、未知 `tableId` 和不兼容的 view/query；错误由通用 tool error UI 呈现。
- 图表组件只收到 `line`、`bar` 或 `histogram` 的受控 schema 和 JSON rows，不接收 HTML/SVG/JavaScript 或 chart-library options。
- `ChartCard` 对三个固定 query/view 组合分别渲染 line、bar、histogram；table 意图不会渲染图表。用户在后续聊天中显式改图种时，前端不本地转换数据，而是等待新的 `query_table` output。
- table card 显示 `sourceMatchedCount`、`resultCount` 和截断标记；导出 card 显示行数和可用下载链接。
- 专用 card 只接管 `output-available` 且与 toolName 对应的 Zod schema 可解析的 `query_table`/`export_table`/`publish_derived_chart` 输出；未知 tool、schema 不匹配、`output-error` 和 pending state 均回退通用 Tool card。

## 验证方法

### 自动检查

```bash
npm run typecheck
npm run test:file-artifacts
npm run build:eve
```

为四个 happy path 各添加一个 Eve eval，并用 `t.sendFile()` 上传 fixture：断言受限 `glob` -> `inspect_attachment` 的调用顺序、关键输入字段和最终回复包含来源表/筛选或截断说明。单候选 CSV eval 断言不调用 `ask_question`；XLSX 用例还断言首次运行在 `ask_question` 停驻，使用 `t.requireInputRequest()` / `t.respondAll()` 选择候选后只查询该 `tableId`。派生 chart eval 断言模型在当前 sandbox 写入并验证 CSV 后调用 `publish_derived_chart`，且 output 的 rows 是派生粒度、非 LLM 文本。单元/组件测试覆盖 group_by/histogram 的 `resultColumns` 与 ordering、CSV header/data 的公式转义、超限 CSV/XLSX 和 session rows/cells/serialized bytes 的 fail-closed 行为、三种 chart、下载链接以及 artifact 默认展开。

### 浏览器检查

按四条 happy path 在 `http://127.0.0.1:3000` 上传实际 fixture，检查合法动态 tool output 被专用 card 替代通用 JSON 展示、图表没有空白、下载文件能打开。派生 chart 场景必须确认图卡来自 `publish_derived_chart` output，且页面没有把 ASCII/Markdown 模拟图当作 chart。再对一个 schema 不匹配或 `output-error` 的工具结果做组件/手工冒烟，确认回退通用 card；不扩展为完整负面测试矩阵。

## 非目标

- PDF/DOCX、OCR、宏、加密/损坏文件、公式重算、Pivot Table 和 Excel 兼容性矩阵。
- 多租户授权、业务系统写入、审批、跨会话 artifact 留存、对象存储下载和负载/性能测试。
- 多条件筛选、排序、SQL、任意表达式、任意脚本或用户自定义 chart options。
