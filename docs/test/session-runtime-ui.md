# 本机会话列表与运行时状态 UI 测试计划

## 目标

以 happy path 验证本机历史 session 恢复与运行时状态弹窗；同时覆盖两个关键边界：不解析/泄露 stream 内容，且状态窗口只读、不管理 VM 生命周期。

## 前置条件

- Next UI 运行在 `http://127.0.0.1:3000`，Eve sidecar 可通过现有 proxy 访问。
- `.eve/.workflow-data/streams/runs/` 至少有两个由本项目创建的 `wrun_*.json` manifest，其中一个可通过 Eve stream 恢复。
- runtime status happy path 使用已切换的 `microsandbox()` backend，并至少创建一个 Eve session VM。
- 测试应覆盖 development 和 production 两种启动模式；两种模式都挂载 `/api/local/*`。当前 POC 没有权限控制，因此不要求 loopback 或认证头。

## Happy path

### 1. 历史 session 列表和恢复

1. 请求 `GET /api/local/sessions`。
2. 断言 response 只有 `sessionId`、`updatedAt`、`source`、`truncated`；session ID 均匹配 `wrun_...`，按 `updatedAt` 倒序，最多 50 条。
3. 打开 Web UI 的 history dialog，断言显示同一批简短 session ID 与本地更新时间，不显示用户消息、assistant 回复、continuation token、sandbox path 或 `.eve` 文件路径。
4. 点击一个已知可恢复项。
5. 断言 URL 为 `/?session_id=<id>`，随后现有 Eve stream replay 恢复历史消息；发送一条 follow-up，断言它继续同一个 session，而不是新建 session。

### 2. 运行时状态快照

1. 打开 runtime status dialog。
2. 断言它在用户打开后才请求 `GET /api/local/runtime`，首屏没有 hydration warning。
3. 断言 response 有生成时间、Eve connectivity、model、sandbox backend、工具/skill 摘要和 MicroSandbox snapshot。
4. 断言 `runningSandboxCount >= 1`；在单项目单 Eve dev server fixture 中，`mappingStatus = "heuristic"` 且 `eveManagedSandboxCount >= 1`。
5. 断言每个展示 VM 的 CPU、memory、uptime 有单位，refresh icon 会获取新的 snapshot；弹窗不提供 stop/delete/restart 按钮。

### 3. 局部故障

1. 停止 Eve sidecar，但保留 `.eve` run manifests；打开两个 dialog。
2. 断言 history dialog 仍显示本地 session ID；runtime dialog 显示 Eve unreachable，聊天 UI 不崩溃。
3. 让 `allSandboxMetrics()` 抛出或当前 backend 不是 microsandbox。
4. 断言 Eve 区仍可显示，MicroSandbox 区显示 unavailable；`eveManagedSandboxCount` 不伪造为 0。
5. 以 production mode 请求 `/api/local/sessions` 和 `/api/local/runtime`，断言仍返回 200 和 allowlisted response；记录当前 POC 没有权限控制的已知边界。

## 自动检查

为 route helper 添加单元测试，使用临时目录和 mock client：

- session scanner 仅接受 regular `wrun_*.json`、拒绝 symlink/其他文件、按 mtime 排序、限制 50 条、目录缺失返回空；
- runtime projection 对 `/eve/v1/info` 和 `allSandboxMetrics()` 的成功、不可达、无效 payload 和 prefix 不匹配分别生成定义中的 response；
- response serialization 不含 continuation token、message、prompt、命令、environment、workspace path；
- dialog component 测试确认 lazy fetch、loading/error/empty state、恢复链接和 refresh 行为。

实施完成后运行：

```bash
npm run typecheck
npm run test:session-runtime-ui
npm run build
npm run build:eve
```

## 浏览器验证

用 Chrome 对第 1、2 节执行一次真实验证：从 history dialog 打开旧 session，发送 follow-up；打开 runtime dialog，记录 VM 数与一项 metrics，点击 refresh 后确认生成时间更新。检查浏览器 console 没有 hydration mismatch，network 中没有从 browser 直接访问 `.eve` 或 `~/.microsandbox`。

## 非目标

- 多用户授权、生产 session browser、跨项目/跨进程 VM 归属准确性。
- session 删除/TTL、VM 关闭和性能/长期稳定性测试。
