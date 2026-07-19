# MicroSandbox 生命周期 POC 设计

## 状态与目标

当前运行时已使用 Eve 官方 `microsandbox()` backend，在不使用 Docker 的前提下提供真实 Linux VM 和 Bash。宿主为 Apple Silicon macOS。本文记录已实现的 POC 生命周期边界与已知限制。

POC 的关键原则是：**Eve 是 sandbox 生命周期的唯一 owner，MicroSandbox 是 Eve 选定的 backend。** 应用 UI、Agent 工具、运维脚本都不能绕过 Eve 直接创建、停止或删除 Eve 管理的 VM。

## 为什么从 programmable justbash 迁移

`programmableJustbash()` 曾为同一虚拟 `/workspace` 增加 ExcelJS 支持的 `xlsx` 命令，适合受限的 CSV/XLSX POC；但它仍是纯 JavaScript 的 Bash 模拟器，不是 Linux 环境。

模型会自然地把 `bash` 当作真实 shell，并尝试 Python、系统 `sqlite3`、qsv/xsv 风格的 `xan` 命令、`/tmp` 和真实 package runtime。justbash 中这些命令要么不存在，要么只是兼容实现，参数和语义不同。已观察到的典型失败包括：

- `sqlite3 -batch`、`.import`、`.headers` 不能按原生 SQLite CLI 工作；
- `xan round()`、`sort -N`、`top -N 5 -s` 不符合其模拟命令的支持范围；
- `python3` 不存在；
- 曾因自定义 CommonJS 加载路径造成 SQLite worker path 为 `undefined`，虽已修复，但这也说明兼容层的调试成本高。

问题不是模型“不会用工具”，而是 Agent 的心智模型与实际环境不一致。把每一种真实命令的差异都写入 Prompt 既不可维护，也无法让 Agent 在陌生分析需求下自行验证和编程。因此 POC 改用更接近生产 sandbox 的真实 VM。

## 运行时边界

```text
Eve durable session
  -> Eve microsandbox backend
      -> one session sandbox / real VM
          -> /workspace persists across turns in one running server
          -> template snapshot supplies bootstrap-installed tools
```

- 一个 Eve Agent 只有一个 sandbox 定义；每个 durable session 有一个对应的 MicroSandbox VM 和持久的 `/workspace`。
- `bootstrap()` 是模板级：安装共享运行时与库，产物进入 snapshot。其重建由 sandbox source、workspace seed、backend options 和 `revalidationKey` 决定。
- `onSession()` 是 session 级：设置网络策略和只属于该 session 的一次性配置，不能把凭据写入模板。
- 命令是独立 shell invocation；文件和脚本会保留，但 shell-local variable、`cd`、函数不会跨命令保留。
- 同一运行中 `/workspace` 跨 turn 已由 0.6.6 集成测试覆盖。Eve 文档声明 session 可在下次启动后重新连接或从 snapshot 恢复；历史上 Eve 0.24.6 + MicroSandbox 0.5.10 的 direct integration test 在 snapshot restore 后丢失 workspace 文件，0.6.6 的服务重启恢复仍未单独验证，因此本 POC 暂不把它作为已验证承诺。
- **历史 shutdown 回归：** 在本机 macOS 上，对 Eve sidecar 发送 `SIGINT` 后，Eve 0.24.6 + MicroSandbox 0.5.10 可能以 PPID 1 留下 `msb` VM。在空闲 heartbeat（所有 active counters 为 0）时它仍可单核约 100% CPU。当前项目已切换到 0.6.6，但尚未把该关停场景作为 0.6.6 的已验证结论；它不是模型命令、文件解析或 guest 工作。在确认 Eve owner 已退出后，才能使用 MicroSandbox SDK 的 `Sandbox.get(name).stopWithTimeout()` 和 `remove()` 回收 orphan；不得对仍被 Eve 持有的 VM 使用此流程。

`session.waiting` 只表示该 session 当前没有 in-flight turn，**不是** sandbox idle timeout。Eve 文档仅为 Vercel hosted backend 明确默认 30 分钟 idle timeout；当前版本没有公开的 MicroSandbox session TTL、按 session stop API 或 idle reaper。

## Backend 与工具基线

`agent/sandbox.ts` 使用 Eve 官方 factory，而非自定义 adapter：

```ts
import { defineSandbox } from "eve/sandbox";
import { microsandbox } from "eve/sandbox/microsandbox";

export default defineSandbox({
  backend: microsandbox({
    cpus: 1,
    memoryMiB: 1024,
    networkPolicy: "deny-all",
  }),
  async bootstrap({ use }) {
    const sandbox = await use();
    // Create /workspace/analysis and verify the Python stdlib baseline.
  },
});
```

具体 package 安装命令必须以目标 image 的首次 `sandbox doctor` 验证结果为准，不能假定基础 image 已有 Python 或某个 CLI。POC 固定 `microsandbox@0.6.6`，`npm run setup:microsandbox` 会在 host 上安装并校验对应 runtime。POC 的 bootstrap 验收工具基线是：Bash/coreutils、`awk`、`sed`、`grep`、`jq`、`python3` 及 Python 标准库的 `csv`/`sqlite3`/`zipfile`/`xml`。本版不在 template bootstrap 在线安装第三方包：`pandas` 会引入大型 NumPy wheel，而当前 MicroSandbox 网络路径连轻量 wheel 的下载都可能无期限停滞。XLSX 的确定性发现保留在 application-runtime 的 ExcelJS tool；未来需要 sandbox 第三方库时使用自定义 OCI image 或随项目提交并离线安装的 wheel。实现会将版本检查和一个小型 CSV/SQLite 程序放在自动测试中；任何缺失项都会让模板构建失败，而不是把不可用命令写进 Prompt。

`xlsx` virtual command 不再是 sandbox 基础能力。确定性 `inspect_attachment`/`query_table` 保持 application-runtime tool；当 Agent 需要超出受限工具范围的变换时，可以在真实 VM 中用已验证的 Python 标准库编写、运行并检查 `/workspace/analysis/` 下的脚本和派生 CSV。本 POC 不承诺已安装第三方 Python 库。

默认 `deny-all` 固定在 backend factory 上。本 POC 的 bootstrap 不需要外网，因此不在 `onSession()` 动态切换策略：当前 MicroSandbox adapter 的策略切换会重建 VM，给本地 workspace 恢复增加不必要的 snapshot 链。以后需要访问外部业务系统时，再通过最小 allowlist 和 per-session credential brokering 设计专门的 session policy；不能为方便而使用 `allow-all`。

## 生命周期 MVP

本 POC 不实现自定义 idle reaper。最小可用机制如下：

| 阶段 | Owner | 行为 |
| --- | --- | --- |
| Eve 启动/首个 session | Eve | 预热或复用模板；从 template snapshot 创建或恢复该 session 的 VM。 |
| bootstrap | Eve sandbox hook | 安装并验证一次性工具链，生成可复用 template snapshot。 |
| session 首次使用 | Eve | 使用 factory 已固定的 `deny-all` 策略；workspace 对本 session 持久。 |
| 普通 turn | Eve | 通过 `ctx.getSandbox()` 执行命令；每个命令须等待退出或由 Eve abort/cancel 终止。 |
| session 等待 | Eve | VM 仍可存在；只记录 `session.waiting`，不据此直接关闭。 |
| Eve 正常退出 | Eve | 设计目标是调用 backend handle 的 `shutdown()` 停止其管理的 VM；当前 macOS 组合存在 orphan 回归，详见本节“已知 shutdown 回归”。 |
| Eve 重启 | Eve | 框架目标是用持久 session metadata 恢复 VM；当前 POC 不承诺 workspace 恢复，待上游 snapshot restore 回归修复后再启用。 |

Agent Prompt 会禁止 `nohup`、`&`、daemon、常驻 server 和 detached process。文件分析是 batch 工作；没有跨 turn 的后台进程需求。每条脚本都必须有确定的退出条件，长任务使用明确命令 timeout/abort，不通过 VM 常驻来规避 timeout。

启动前和正常停止后可做只读 `allSandboxMetrics()` 检查，确认本机运行的 VM 数量。不得运行裸 `msb stop`、删除 `~/.microsandbox/sandboxes/*` 或按名字 kill `msb`：那会让 Eve 的 session handle 与真实 VM 脱节。若后续确实需要 idle 回收，必须先新增一个由 Eve backend wrapper 维护的 session-to-sandbox ownership map，再通过该 owner 协调 stop/recovery；这不是本 MVP 的范围。

## 可观测性与故障处理

- `/eve/v1/info` 仅提供 agent、工具与 sandbox 定义的 inspection snapshot，不提供活动 session 或 VM 列表。
- MicroSandbox 的 `allSandboxMetrics()` 能返回当前所有运行 VM 的 CPU、内存、I/O 与 uptime；它是 runtime snapshot，不是 session ownership API。
- 当前 Eve 0.24.6 内部的 session VM 名称以 `eve-sbx-ses-` 开头。这可用于本机单应用 POC 的聚合诊断，但不是 Eve public contract，也不能据此执行生命周期操作。
- `session.waiting`、最近 command 完成时间和 MSB metrics 只能作为观测字段，不能在没有明确策略和 owner map 的情况下触发回收。
- `allSandboxMetrics()` 的 `cpuPercent` 是 guest vCPU 指标，可为 0 而 host `msb` 仍在空转。CPU 调查必须同时对比 host `ps`/`top`、heartbeat 和 metrics；不能只以 UI 的 metrics 作为“空闲正常”证据。

当真实 VM 命令失败时，保留 exit code、stdout/stderr 和 command 作为 Eve tool result；Prompt 要求模型读取错误、调整脚本并重试，而不是把未知需求交给默认子 Agent 或假装成功。

## 非目标

- Docker、host shell 访问、任意网络访问、自动安装用户指定的任意 package。
- idle timeout/reaper、跨进程 VM ownership registry、后台作业队列和多主机 session 调度。
- 生产级 VM 资源配额、租户隔离、凭据审计和 retention/delete 策略。

## Concept Delta

`Eve session`、`sandbox`、`template`、`workspace`、`bootstrap`、`onSession` 与 `MicroSandbox` 均沿用 Eve/MicroSandbox 文档术语。`生命周期 MVP` 与 `sandbox doctor` 是本项目的实现提议，不声明为跨项目 canonical 概念。仓库缺少 glossary、context map 与 decision record；本文不创建这些治理文件。
