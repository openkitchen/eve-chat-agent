# 本地验证

本项目使用 Eve 原生 eval 做自动验证。没有正在运行的 Eve runtime 时，`eve eval` 会启动独立的 runtime；已有 runtime 时，使用 `--url` 将 eval 指向它。控制台不会输出 API key、base URL、请求正文或模型回复。

## 验证命令

| 命令 | 目的 | 通过条件 |
| --- | --- | --- |
| `npx eve eval` | 使用 `.env.local` 的真实 provider 验证多轮会话 | 两轮均成功完成，且两轮的 `sessionId` 相同 |
| `npx eve eval session-continuity` | 只运行多轮会话 eval | 同上 |
| `npx eve eval --url http://127.0.0.1:<eve-port>/` | 验证正在运行的本地 Agent | 同上 |

当前已有 Eve runtime 时，使用启动输出中的端口，或读取 `.eve/dev-server-state.v1.json` 后将其中的 `url` 传给 `--url`。这个 eval 会消耗两次真实模型调用。Eve 会将运行摘要、断言结果和完整事件流写到 `.eve/evals/<timestamp>/`；控制台保持简洁，排查失败时应优先查看该目录。

## 配置验收

`agent/agent.ts` 使用 `createOpenAI`，从以下环境变量读取配置：

| 变量 | 用途 |
| --- | --- |
| `OPENAI_BASE_URL` | OpenAI-compatible Responses API 的 `/v1` 基地址 |
| `OPENAI_API_KEY` | 服务端密钥 |
| `OPENAI_MODEL` | 模型 ID；未设置时默认 `gpt-5.4-mini` |
| `OPENAI_API_MODE` | `responses` 或 `chat`；DeepSeek 等 Chat Completions-compatible 服务使用 `chat` |

`agent/agent.ts` 同时设置 `modelContextWindowTokens: 128_000`。这是自定义模型不在 AI Gateway catalog 中时 Eve 编译长会话能力所必需的显式上下文窗口配置。

运行中的 Eve runtime 以 `session.started` 事件里的 `modelId` 为准。`eve info` 的 compiled manifest 可用于验证下一次新启动会加载的配置，但不能证明一个已存在的开发 sidecar 已刷新。

## 已验证问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| TUI 显示旧模型 ID | `eve dev` 会附着到 `.eve/dev-server-state.v1.json` 记录的健康 runtime | 停止该 sidecar 后再启动；`eve eval` 会自行启动临时 runtime，不复用它 |
| 首轮后续聊失败 | 默认 Responses storage 会把历史输出压缩为 `item_reference`，部分兼容服务不支持 | `modelOptions.providerOptions.openai.store = false`，每轮重发完整历史 |
| 模型服务只支持 Chat Completions | agent 固定使用 `/responses` | 设置 `OPENAI_API_MODE=chat`，改用 `/chat/completions` |
| 网页没有显示失败 | 默认 React reducer 保留 `turn.failed` 事件但不把它映射到 `agent.error` | 聊天页面显示最近一次失败事件的安全摘要 |
| `fetch failed` / HTTP 502 | 自定义 provider 的网关或上游模型暂时失败 | 用 `npx eve eval` 重现；这不是 Eve 会话状态错误 |

## 日志

`npm run dev:log` 会追加写入 `logs/dev.log`。模型调用失败的详细堆栈可能包含聊天正文，因此该文件只应保留在本机，不应提交或上传。

## Phoenix trace

运行 `npm run dev:phoenix` 后，Phoenix 在 http://localhost:6006 接收 Eve 的 OpenTelemetry trace。`agent/instrumentation.ts` 明确启用了 `recordInputs` 和 `recordOutputs`，因此 trace 包含 system prompt、会话历史、模型输出、工具调用和工具结果。

本地开发默认发送到 `http://127.0.0.1:6006/v1/traces`，可通过 `.env.local` 的 `PHOENIX_ENABLED`、`PHOENIX_COLLECTOR_ENDPOINT` 覆盖。将 `PHOENIX_ENABLED=false` 用于不应生成 trace 的自动测试。trace 内容包括聊天正文，只能保留在受信任的本机环境。
