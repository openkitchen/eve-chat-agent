# Self-Hosted Eve Agent

这是一个可在本机或自有服务器运行的 Eve 聊天 Agent。Next.js 负责聊天界面，Eve 负责会话、流式响应和工具调用；模型通过 OpenAI API 直接访问，不依赖 Vercel 部署。

## 本地运行

```bash
cd /Users/wei/workspaces/openkitchen/alpha-agent/eve-chat-agent
source "$HOME/.nvm/nvm.sh"
nvm use
cp .env.example .env.local
```

在 `.env.local` 中填写兼容 OpenAI API 的配置：

```dotenv
OPENAI_BASE_URL=https://your-provider.example/v1
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_API_MODE=responses
```

`OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL` 和 `OPENAI_API_MODE` 都只由服务器进程读取；不要把 `.env.local` 提交到 Git。`OPENAI_API_MODE=chat` 使用 `/chat/completions`，适合 DeepSeek 等 Chat Completions-compatible 服务；`responses` 使用 `/responses`。然后启动：

```bash
npm run dev
```

打开终端输出的本地地址。Eve 的 HTTP 会话接口由 Next.js 同源代理，浏览器不需要单独配置 Agent URL。

## Phoenix 本地观测

Phoenix 运行在本机，记录每次 LLM 调用的 system prompt、会话历史、模型输出和工具调用。内容会保存在本机 Phoenix 数据中，不会上传到 Vercel。

先启动 Phoenix：

```bash
npm run dev:phoenix
```

打开 http://localhost:6006，然后另开一个终端启动网页服务：

```bash
source "$HOME/.nvm/nvm.sh"
nvm use
env -u OPENAI_MODEL -u OPENAI_API_MODE -u OPENAI_BASE_URL -u OPENAI_API_KEY npm run dev:log
```

网页在 http://localhost:3000。每次聊天的 trace 会出现在 Phoenix 的 `eve-chat-agent` project。`PHOENIX_ENABLED`、`PHOENIX_COLLECTOR_ENDPOINT` 和 `PHOENIX_PROJECT_NAME` 可在 `.env.local` 中覆盖。

## 验证与生产构建

```bash
npm run typecheck
npm run build:eve
npm run build
npm start
```

`npm run build:eve` 必须在 `npm run build` 前运行。生产环境需要配置自己的认证方式；当前默认配置只允许 localhost，公网请求会被拒绝。

## Eve 原生验证

```bash
npx eve eval
```

这是 Eve 官方的 eval 路径。没有正在运行的 Eve runtime 时，它会启动独立的本地 runtime；使用 `.env.local` 中的真实 provider 配置，通过与网页相同的 HTTP 会话接口完成两轮对话，并验证两轮使用同一个 durable session。

通过时退出码为 `0`。失败时，完整的事件流与断言结果会保存在 `.eve/evals/<timestamp>/`。若只想运行这一项测试，使用：

```bash
npx eve eval session-continuity
```

如果已经运行了 `npm run dev:eve` 或网页开发服务，Eve 会要求显式传入该 runtime 的本地 URL。使用启动输出中的端口运行：

```bash
npx eve eval --url http://127.0.0.1:<eve-port>/
```

该 URL 也会记录在 `.eve/dev-server-state.v1.json`。这是 Eve 官方的本地 target 模式，eval 会对运行中的 Agent 新建独立测试 session，不会影响当前聊天 session。

每次 eval 都会产生真实模型调用。启动 Phoenix 后，这些调用也会出现在本地 Phoenix 项目中；如需在不发送 trace 的情况下运行，可临时覆盖环境变量：

```bash
PHOENIX_ENABLED=false npx eve eval
```

详细的测试范围和故障定位见 [docs/local-verification.md](docs/local-verification.md)。

## 当前能力

- 流式网页聊天
- 可恢复的 Eve 会话
- 安全的 `get_current_time` 示例工具
- 支持自定义 OpenAI-compatible `base URL`、API key 与 model
- 支持可配置的 `chat` / `responses` API 模式
- Phoenix 本地 LLM trace，包含输入、输出和工具调用
- 为未收录的自定义模型显式设置 128k context window
- Responses API 续聊会重发完整历史，兼容不支持 `item_reference` 的服务

后续接入公网前，应在 `agent/channels/eve.ts` 中替换 `placeholderAuth()`，例如接入现有的 JWT、OIDC 或应用会话认证。
