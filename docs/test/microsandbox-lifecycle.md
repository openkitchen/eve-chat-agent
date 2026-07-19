# MicroSandbox 生命周期 POC 测试计划

## 目标

验证真实 MicroSandbox backend 的最小运行时契约、Eve 管理的当前运行期 workspace 与正常 shutdown。不测试 Docker、自动 idle 回收、长时间压力、多主机恢复或已知未通过的 server-restart workspace 恢复。

## 前置条件

- `agent/sandbox.ts` 已从 `programmableJustbash()` 切换到 Eve 官方 `microsandbox()`。
- 本机为 Apple Silicon macOS，项目固定 `microsandbox@0.6.6`；先运行 `npm run setup:microsandbox` 校验 `msb` runtime，不启动 Docker。
- bootstrap 已按设计安装并锁定 POC 工具基线，`onSession()` 配置 `networkPolicy: "deny-all"`。
- Eve dev server 和 Web UI 使用正常启动路径，测试后以 `SIGINT` 正常结束 Eve，不能手动 kill `msb`。

## Happy path

### 1. 模板与工具基线

1. 启动空的新 Eve session，等待 template bootstrap 完成。
2. 在 sandbox 运行 doctor：检查 Bash、`awk`、`sed`、`grep`、`jq`、`python3`，并运行 Python import `csv`、`sqlite3`、`zipfile`、`xml`。
3. 用 Python 标准库 `sqlite3` 创建数据库、导入两行 CSV、执行 `SELECT`；生成并读回一份 CSV 派生结果。XLSX 的确定性解析由 `inspect_attachment` 的 ExcelJS 实现覆盖。
4. 断言所有命令 exit code 为 0，输出与 fixture 一致；无 command 通过 justbash 的模拟实现。
5. 重开一个新 session，断言 bootstrap 不为每个 session 重新安装依赖，而是复用 template snapshot。

### 2. 当前 session 的真实编程分析

1. 从浏览器上传 `test/fixtures/file-artifacts/monthly-orders.csv`。
2. 发送“按月汇总金额并画折线图”，不指定实现方法。
3. 断言 Agent 在当前 `/workspace/analysis/` 写入并执行可退出的 Python 或 Bash 脚本，检查生成的 `month,total_amount` CSV，再调用 `publish_derived_chart`。
4. 断言 chart rows 是聚合后的 2 行数据，页面显示真实 line chart，而不是 Markdown/ASCII 模拟图。

### 3. workspace 跨 turn

1. 在一个 session 写入 `/workspace/analysis/sentinel.txt`，第一条消息结束并等待 `session.waiting`。
2. 第二条消息读取该文件，断言内容未丢失。
3. 断言同一 session 的后续消息可读取该文件，且不把 `session.waiting` 当作已关闭或删除的证据。

历史 Eve 0.24.6 + MicroSandbox 0.5.10 的 direct integration test 在 `captureState -> shutdown -> restore` 后丢失 workspace 文件；0.6.6 的服务重启恢复尚未单独验证，因此本 POC 不把服务重启恢复列为通过条件。该场景应作为单独回归测试，不能用手动重建 session 冒充恢复成功。

### 4. 网络和命令终止

1. 在 sandbox 尝试访问一个公网 URL，断言由于 `deny-all` 失败。
2. 运行一个有明确 sleep 的长命令，在 Eve cancel/abort 后确认该 command 退出，之后 session 可继续接收消息。
3. 断言没有 `nohup`、`&` 或常驻 server；错误作为 tool result 可被模型读取。

### 5. 正常 shutdown 的 VM 状态（当前诊断回归）

1. 在启动 Eve 前调用 `allSandboxMetrics()` 记录运行 VM 名称与数量。
2. 通过一个 session 确认至少创建一个 `eve-sbx-ses-` VM；记录 metrics snapshot。
3. 用 `SIGINT` 正常结束 Eve，等待其 shutdown 完成。
4. 同时检查 `ps` 中的 `msb`、`allSandboxMetrics()` 和 VM heartbeat。设计期望是测试启动的 running VM 不再出现；历史 Eve 0.24.6 + MicroSandbox 0.5.10 在 macOS 会留下 PPID 1 的 orphan `msb`，0.6.6 的该场景尚未单独验证，结果必须作为诊断记录，不能默认为通过。
5. 只在已确认 Eve 进程已退出、VM PPID 为 1 后，使用 MicroSandbox SDK 的 `Sandbox.get(name).stopWithTimeout()` 和 `remove()` 回收 orphan。不得使用裸 `msb stop`、`kill` 或删除持久目录。

## 自动化与人工验证

自动化应至少包含：一个真实 sandbox integration test（工具基线 + SQLite + Python/XLSX）、一个 Eve eval（上传 CSV 后产出派生 chart）和 sandbox config 的 type/build 检查。

```bash
npm run setup:microsandbox
npm run typecheck
npm run test:microsandbox
npm run test:file-artifacts
npm run build:eve
```

浏览器只需完成第 2 和第 3 节：上传 CSV、检查 chart、复制 session URL 并在同一运行期恢复同一会话。运行时状态窗口的计数和 metrics 字段按 `docs/test/session-runtime-ui.md` 验证。

## 失败判定

- 任一基线命令缺失、模拟成功或需要 host shell 才能完成。
- 每个 session 都重复 package install，或同一 session 的 workspace 不持久。
- 正常关闭后仍残留本次 Eve 创建的 running VM；当前组合已知会触发此上游回归，需以 diagnostic failure 报告而不是静默通过。
- 为了清理 VM 而执行直接 `msb stop`、kill 或删除 MicroSandbox 持久目录。
- `session.waiting` 被实现为 idle timeout/reaper 的触发条件。

## 非目标

- 自动 idle reaper、CPU 异常检测阈值、长期泄漏/性能压测和同时多个 Eve 进程的 ownership 隔离。
- 不同宿主平台、不同 OCI image、外网 allowlist 和真实业务凭据。
