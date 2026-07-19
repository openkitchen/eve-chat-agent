# Phoenix

本项目将 Eve/AI SDK 的 OpenTelemetry spans 导出到本机 Phoenix。`agent/instrumentation.ts` 默认记录完整输入和输出，因此 trace 包含 prompt、模型回复和工具调用。

## 启动与查看

启动本地 Phoenix：

```bash
npm run dev:phoenix
```

Phoenix Python virtual environment 不放在项目目录，默认位置为
`$XDG_CACHE_HOME/eve-chat-agent/phoenix-venv`（macOS/Linux 未设置
`XDG_CACHE_HOME` 时为 `$HOME/.cache/eve-chat-agent/phoenix-venv`）。需要使用另一套环境时：

```bash
PHOENIX_VENV_DIR=/path/to/phoenix-venv npm run dev:phoenix
```

打开 [http://127.0.0.1:6006](http://127.0.0.1:6006)，选择 `eve-chat-agent` project。启动网页服务或执行一次 Eve eval 后，刷新 traces 页面即可查看调用链。

本地配置由 `.env.local` 控制：

```dotenv
PHOENIX_ENABLED=true
PHOENIX_COLLECTOR_ENDPOINT=http://127.0.0.1:6006/v1/traces
PHOENIX_PROJECT_NAME=eve-chat-agent
```

需要禁用 trace 时，在启动新的 Agent runtime 前覆盖：

```bash
PHOENIX_ENABLED=false npx eve eval
```

该命令只影响它自行启动的 runtime；不能关闭已经运行的 `--url` target 的 trace。对现有网页服务或 `npm run dev:eve`，先停止服务，再以该环境变量重启。

## 验证

确认 UI 服务已经可用：

```bash
curl -fsS http://127.0.0.1:6006/ >/dev/null
```

随后运行一次 `npx eve eval`，或向网页聊天发送一条消息。两者都会向已配置的 OTLP collector 写入 trace。

输入与输出会存入 Phoenix；仅在受信任的本机或受控环境中启用完整记录。

## 官方参考

- [Arize Phoenix documentation](https://arize.com/docs/phoenix)
- [Phoenix tracing tutorial](https://arize.com/docs/phoenix/tracing/tutorial)
