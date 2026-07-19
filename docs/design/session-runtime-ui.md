# 本机会话列表与运行时状态 UI 设计

## 目标与范围

在当前本机 POC 的 Web UI 增加两个开发者入口：

1. 历史 Eve session 列表：列出当前项目工作目录中已持久化的 session，点击后以现有 `?session_id=<id>` 恢复聊天。
2. 运行时状态：打开一个只读弹窗，显示当前 Eve inspection、MicroSandbox 活动数量和可安全取得的 metrics。

这是**本机开发诊断 UI**，不是业务用户的会话中心，也不是生产监控系统。它只面向启动该 Next/Eve 实例的本机用户；生产版必须由宿主业务系统提供身份、session ownership、保留与审计。

## 已验证的数据边界

Eve 0.24.6 的公开 HTTP API 有：`GET /eve/v1/info`、单个 session 的 stream、创建/follow-up/cancel session；没有列举历史 session 的公开 route，也没有按 Eve session 统计 MicroSandbox VM 的公开 route。

因此不能伪造一个“Eve session list API”。本设计新增两个 Next server route，作为本机 adapter：

- 它们只在开发模式挂载，并只接受 loopback 请求；production 返回 `404`。
- 不能从浏览器读取 `.eve`、`~/.microsandbox` 或执行 `msb` CLI。
- route 返回 allowlisted 的摘要，不返回 continuation token、模型 prompt、会话消息、文件内容、sandbox 路径、命令或环境变量。

前端继续通过 Eve 的正式 stream API 恢复和继续会话；本地 adapter 只用于“找到一个候选 session”和“查看状态”。

## 本地 session 索引

### 数据源与安全规则

Eve 将本地 durable stream 的 run manifest 放在 `.eve/.workflow-data/streams/runs/<sessionId>.json`。该 manifest 是当前开发 runtime 的内部存储格式，不是 Eve public contract，因此本 UI 只把它用作本机索引，绝不解析二进制 stream chunks 来生成消息标题或历史内容。

服务器端扫描时必须：

- 固定根目录为当前项目的 `.eve/.workflow-data/streams/runs`，不接收客户端提供的路径或 glob；
- 仅接受文件名匹配 `wrun_[A-Za-z0-9]+.json`；
- `lstat` 后拒绝 symlink 与非 regular file；
- 使用 manifest 的 `mtime` 作为 `updatedAt` 近似值，按新到旧排序；
- 限制最多返回 50 项；缺失目录时返回空列表；单个损坏 manifest 只跳过并记录 server-side warning；
- 列表不读取/展示用户消息，因为那需要依赖 Eve 私有 binary chunks 且会把敏感内容放入 UI。

### Route 契约

```http
GET /api/local/sessions
```

```ts
type LocalSessionSummary = {
  sessionId: string;
  updatedAt: string; // manifest mtime, ISO-8601
};

type LocalSessionsResponse = {
  sessions: LocalSessionSummary[];
  source: "eve-local-run-manifests";
  truncated: boolean;
};
```

点击某项只执行导航：

```text
/?session_id=<encoded sessionId>
```

页面已有的 `fetchRecoveredEveSession()` 仍以 `GET /eve/v1/session/:id/stream` 重放并取得最新 continuation token。该请求失败、stream 不可恢复或 session 无权限时，保持当前的“恢复失败”状态；列表项不等于可恢复性保证。

UI 放置在聊天 header 的 history icon button。弹出 sheet/dialog 展示 session ID 的短格式和本地更新时间；点击行立即导航。它不提供删除、重命名、搜索、跨项目聚合或“当前 session 一定 active”的标签。

## 运行时状态

### 数据源

状态窗口聚合两类只读数据：

| 字段组 | 来源 | 稳定性与限制 |
| --- | --- | --- |
| Eve runtime | Next server 向当前 Eve sidecar 请求 `GET /eve/v1/info` | Eve 公开 inspection API；只投影 model、sandbox backend、已加载 tools/skills 的名称和 Eve 是否可达。 |
| host MicroSandbox | Node server 以 `Sandbox.list()` 的 `running`/`draining` 状态过滤 `allSandboxMetrics()` | MicroSandbox 公开 API；避免把已停止但仍在本机数据库中的历史 sandbox 计为活动 VM。 |
| Eve-managed MSB 近似计数 | 对 `allSandboxMetrics()` 的 VM 名称过滤 `eve-sbx-ses-` | 当前 Eve 0.24.6 内部命名约定，非 public contract；仅在“单项目、单 Eve dev server”的 POC 中使用。 |

Eve 没有公开 session-to-VM ownership mapping，所以 UI **不能**声称每个 VM 属于哪个 `sessionId`，也不能提供 stop/restart 控制。若名称前缀不再匹配，response 必须把 `eveManagedSandboxCount` 标为 `null` 与 `mappingStatus: "unavailable"`，而不是显示 0。

### Route 契约

```http
GET /api/local/runtime
```

```ts
type SandboxMetricSummary = {
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  uptimeMs: number;
  timestamp: string;
};

type LocalRuntimeResponse = {
  generatedAt: string;
  eve: {
    reachable: boolean;
    model?: string;
    sandboxBackend?: string;
    toolNames?: string[];
    skillNames?: string[];
    error?: "unreachable" | "invalid_info";
  };
  microsandbox: {
    runningSandboxCount: number;
    eveManagedSandboxCount: number | null;
    mappingStatus: "heuristic" | "unavailable";
    sandboxes: SandboxMetricSummary[];
    error?: "unavailable";
  };
};
```

字段只表达调用时刻的 snapshot：`runningSandboxCount` 是本机所有 MSB VM 的数量，`eveManagedSandboxCount` 是当前可识别的 Eve session VM 数量，二者都不代表等待中的 session 数、历史 session 数或永久资源占用。CPU/内存不能作为自动回收的直接动作条件。

UI 以 header 的 activity/status icon button 打开 modal。打开时 fetch 一次，并提供 icon-only refresh button；展示生成时间、Eve connectivity、model、sandbox backend、工具/skill 数量、运行 VM 总数、可识别 Eve VM 数和每个可见 VM 的 CPU/内存/uptime。请求失败时显示明确的局部错误，不阻塞聊天和历史 session 列表。

## 前端结构

```text
AgentChat header
  -> History button -> LocalSessionDialog -> GET /api/local/sessions
                        -> click -> ?session_id=... -> existing Eve stream recovery
  -> Runtime button -> LocalRuntimeDialog -> GET /api/local/runtime
                        -> Eve /eve/v1/info + MicroSandbox metrics snapshot
```

- 两个 dialog 都是 client component；route handler 是唯一拥有 filesystem/sidecar/MSB access 的位置。
- SSR 首屏不读取本地状态：避免 hydration mismatch，也避免把主机状态缓存进 HTML。数据仅在用户打开 dialog 后在 client effect 中加载。
- 现有 session/run copy button 保持不变；历史列表中的 ID 不复制 continuation token。
- 两个入口在空白初始页面也可用，便于恢复旧 session 或诊断 Eve sidecar 未启动的情况。

## 错误与授权

- Eve sidecar 不可达：状态 dialog 显示 Eve unreachable；历史列表仍可从本地 manifest 返回 ID，但点击后会由既有恢复流程显示错误。
- MicroSandbox 未安装、API 调用失败或当前 backend 不是 microsandbox：保留 Eve 状态，MicroSandbox 区显示 unavailable；不在 route 内安装 runtime，也不启动/停止 VM。
- 本地 manifest 不存在或已清理：返回空数组，不报 500。
- 生产环境、非 loopback 请求或未通过宿主认证的请求：不暴露任一 local route。未来 production 实现必须改为宿主数据库的 thread/session 映射与 RBAC，不能复用 `.eve` 扫描。

## 非目标

- Eve session 删除、TTL、搜索、标题生成、跨浏览器同步或多用户会话管理。
- 自动关闭 idle MSB、手工 VM stop、CPU 阈值报警或 host process 管理。
- 将 Phoenix trace、完整 prompt/tool payload 或 `.eve` 原始事件嵌入聊天 UI。

## Concept Delta

`sessionId`、`Eve inspection`、`sandbox` 和 `MicroSandbox metrics` 是既有框架/SDK 术语。`本地 session 索引`、`运行时状态`、`heuristic mapping` 是此 POC 的 UI/API 提议术语，不是业务领域概念。仓库缺少 glossary、context map 与 decision record；本文不将它们声明为 canonical。
