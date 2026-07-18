# 会话恢复与调试标识设计

## 目标

让本地聊天 UI 的使用者能够复制一个稳定的会话标识用于排障，并通过 URL 恢复已持久化在 Eve 服务端的历史会话。此设计只定义本地 POC；生产环境的会话授权和保留策略仍由宿主业务系统负责。

## 标识语义

Eve 的 HTTP session stream 使用 `sessionId` 作为读取、重放和继续会话的句柄。当前 workflow runtime 返回的 `sessionId` 本身就是 workflow run ID，因此 UI 使用一个值并标注为 `session/run`：

```text
sessionId: wrun_...
runId: wrun_...  // same value in the current runtime
```

`turnId` 是同一 session 内每一条用户输入对应的单次 turn 标识；一个 session 必然有多个 turn。它保留在 Eve stream event 中供精确排障使用，但不在 POC 前台显示或复制。`continuationToken` 是继续会话的能力凭据，不显示、不复制、不写入 URL 或浏览器日志。

## 前台行为

第一条消息获得 `agent.session.sessionId` 后，客户端使用 `history.replaceState` 将浏览器地址改为 `/?session_id=<sessionId>`。聊天头部不显示 run/session 标识；最新一组已完成的 assistant 回复下方显示截断的 `session/run` 值和一个复制图标。复制内容固定为完整的 `sessionId` 和同值的 `runId`，不包含 turn ID 或 continuation token。该标识是整条会话的诊断定位符，不是单次回复的 ID，因此不在每个 tool step 或普通文本片段后重复显示。

当用户把该值提供给开发者时，开发者通过 Eve 的正式接口而非解析 `.eve` 私有存储排查：

```text
GET /eve/v1/session/<sessionId>/stream?startIndex=0
```

该持久化 stream 包含用户消息、模型步骤、tool call、tool result、失败事件和每个 `turnId`。因此 `sessionId` 足以定位任意历史 turn；需要缩小范围时，开发者从 stream 内选择对应的 `turnId`。

## URL 恢复

本地 POC 使用 `/?session_id=<sessionId>` 作为可恢复会话 URL。URL 只携带 `sessionId`。

```text
Browser loads ?session_id=wrun_...
  -> GET /eve/v1/session/<sessionId>/stream?startIndex=0
  -> replay durable events into initialEvents
  -> read the newest session.waiting event for continuationToken
  -> initialize useEveAgent({ initialEvents, initialSession })
  -> subsequent send resumes the same durable session
```

`useEveAgent()` 的 initial session/options 仅在 store 创建时读取，因此 URL session 改变时聊天组件必须以 `sessionId` 为 React key 重新挂载。stream 获取失败、session 不存在或未出现可续接的 `session.waiting` 时，UI 显示恢复失败，不将旧事件与新会话混合；用户可改为新聊天。

仅重放历史而不继续时，仍必须从完整 stream 构造 UI messages，不能扫描 `.eve/.workflow-data/` 的私有二进制 chunks。后者是 Eve 实现细节，不是稳定的应用接口。

## 授权与边界

当前本地 `localDev()` 允许本机开发访问。生产环境必须让 Eve channel 和宿主应用认证当前用户，并校验该用户对 session 的所有权后才允许 stream/replay/continue。`sessionId` 是定位符而非登录凭据，但在缺少授权的环境中仍可能泄露会话内容；不可将带有 session query 的 URL 发送给无权限的人。

本设计不增加多线程会话列表、跨设备同步、session 删除、数据保留策略或 continuation token 持久化。宿主业务系统日后应以自己的 thread ID 映射 Eve session ID，并定义到期与审计策略。

## Concept Delta

`sessionId`、`runId`、`turnId` 和 `continuationToken` 是 Eve 协议术语；`session/run` 是当前 UI 对同一 workflow 标识的显示标签。它们均为实现/协议层术语，不是业务领域概念。仓库缺少 glossary、context map 和 decision records，因此不将它们声明为 canonical。
