# Eve Evals

Eve eval 通过与聊天界面相同的 HTTP 会话接口驱动真实 Agent，并对运行结果做断言。项目的 eval 位于 `evals/`：`evals.config.ts` 定义共享限制，`*.eval.ts` 定义测试用例。

## 运行

未运行 Eve runtime 时，直接执行：

```bash
npx eve eval
```

只运行多轮会话检查：

```bash
npx eve eval session-continuity
```

已运行网页服务或 `npm run dev:eve` 时，读取当前 Eve runtime URL，并将 eval 指向它：

```bash
cat .eve/dev-server-state.v1.json
npx eve eval --url http://127.0.0.1:<eve-port>/ session-continuity
```

`session-continuity` 会在同一个 durable session 中发送两轮消息，并验证两轮的 `sessionId` 相同。每次运行会产生真实模型调用；退出码 `0` 表示所有硬断言通过。

## 排查与 CI

运行产物在 `.eve/evals/<timestamp>/`，其中包含 `summary.json`、断言结果和完整事件流。CI 使用：

```bash
npx eve eval --strict --junit .eve/junit.xml
```

`--strict` 会使未达标的 soft assertion 失败；上传 `.eve/evals/` 作为失败产物。

## 官方参考

- [Eve Evals overview](https://eve.dev/docs/evals/overview)
- [Running evals](https://eve.dev/docs/evals/running)
- [Eval targets](https://eve.dev/docs/evals/targets)
