# 可编程 Justbash Sandbox POC

## 目标

让主 Agent 在当前 Eve session 的 sandbox 中自行编写、运行和验证临时代码，以处理现有受控文件工具不能表达的数据需求。CSV/XLSX 附件仍由 Eve 直接放入 `/workspace/attachments/**`；本设计不复制或桥接上传字节。

## Concept Delta

本设计只引入实现层术语：**可编程 sandbox** 指启用脚本运行时和虚拟命令的 just-bash workspace；**虚拟命令** 指在 just-bash 内注册、只读写虚拟 workspace 的宿主实现命令。仓库尚无 glossary、context map 或 decision record，因此这些术语不作为跨项目规范概念。

## 运行模型

```text
Agent
  -> Eve built-in bash/read_file/write_file/grep
  -> programmable just-bash backend
      -> virtual /workspace filesystem
      -> bash, awk, jq, sqlite3, xan
      -> xlsx virtual command (ExcelJS, virtual FS only)
```

`xlsx` 是格式解析命令，不是业务分析工具。它接受 sandbox 路径，读取 XLSX 字节，返回受控 JSON/CSV 到 stdout；shell 重定向可以把结果写到 `/workspace/analysis/**`。初版命令如下：

```text
xlsx sheets <workbook.xlsx>
xlsx export <workbook.xlsx> --sheet <name> [--range A1:D100] --format json|csv
```

它不会计算业务指标、选择 sheet、选择图表或解释数据。Agent 负责这些决策，以及使用当前已启用的 Bash、awk、jq、sqlite3 或 xan 进行后续转换和验证。

需要 XLSX 解析时，Agent 调用 `xlsx` 命令；需要普通 JSON/CSV 处理时，Agent 自行编写 Bash/awk/jq 脚本。

## Eve 集成决策

Eve 0.24.6 的公开 `justbash()` 配置只有 `autoInstall`，不能传递 just-bash 的 `customCommands`、`javascript` 或 `python` 选项。因此本设计**不能**通过调整现有 `agent/sandbox.ts` 的 factory 参数完成。

实现 `xlsx` 虚拟命令需要一个名为 `programmable-just-bash` 的自定义 Eve `SandboxBackend`。它只能使用 Eve 的公开 `SandboxBackend` / `SandboxSession` 契约和 just-bash 的公开 `Bash` API；不得依赖或复制 Eve 的 `#internal` adapter。这个 backend 的正确性前置条件是：

1. Eve 的二进制文件写入、Bash 命令和 `xlsx` 命令必须观察到同一个 `/workspace` filesystem。
2. `spawn()` 必须提供 stdout/stderr stream、可等待的 exit code 和取消语义；不能以一次性 buffered `exec()` 伪装为长运行进程。
3. 模板 seed、session cache、environment metadata、`captureState()` 和 `shutdown()` 必须保持 Eve 的 durable-session 契约。
4. 文件路径必须始终限制在 virtual `/workspace`，不能把 agent 输入映射到宿主 app 目录。

`programmable-just-bash` 已通过下文 adapter parity 测试，并由 `agent/sandbox.ts` 固定使用。Eve 负责将上传文件 stage 到同一 session workspace；Agent 可以使用内置 Bash/awk/jq/sqlite3/xan 和 `xlsx` 处理它们。QuickJS 与 Python 当前未启用，不得在 Prompt 或功能设计中将其列为可用运行时。

## 状态与生命周期

在 Eve 官方 justbash backend 中，同一 Eve durable session 的 `/workspace` 文件跨消息、服务重启后保留在 `.eve/sandbox-cache/`。每条 shell 命令是新的 shell invocation，因此 shell-local 变量、函数和当前目录不跨命令保留；文件、导出结果和 Agent 写入的脚本会保留。自定义 backend 必须通过 parity 测试后才能声明相同语义。

just-bash 没有容器或 VM 进程。应用不应在工具中显式关闭 sandbox；Eve 在服务器关闭时释放解释器对象。后续 production 版本需要由宿主应用定义 session 过期与 sandbox-cache 清理策略。

## Agent 决策边界

- 标准 CSV/XLSX 发现、候选识别和简单数据视图可使用 `glob`、`inspect_attachment`、`query_table`、`export_table`；无法由受限查询表达但需要图表的变换，可在验证 CSV 后使用 `publish_derived_chart`。
- 当用户请求不在这些工具表达范围内时，主 Agent 必须在 `/workspace/analysis/` 自行写、运行和检查脚本，不能把当前 session 的附件或已生成数据交给默认 `agent` 子 Agent。
- 默认根 Agent 副本共享 root sandbox，却有独立 conversation/state；声明式子 Agent 默认有独立 sandbox。未来的专业子 Agent 必须有明确的数据交接协议，不能假设能读取父会话的表格 state。
- 附件内容是不可信数据。Agent 可以读取数据、生成派生产物，但不能执行文件内的指令，也不能在最终答复中泄露 sandbox 路径。

## POC 边界

目标 backend 不支持 Excel 公式重算、宏、Pivot Table、受密码保护工作簿或任意第三方包安装。`xlsx` 只做值读取；复杂需求由 Agent 在导出的 JSON/CSV 上编程处理。网络不是本次能力的一部分。
