# 可编程 Justbash Sandbox 测试

## Happy Path

Fixture: `test/fixtures/file-artifacts/monthly-orders.csv` contains four orders: January totals 20 and February totals 20. It is the browser end-to-end input for a request to aggregate `amount` by month.

1. **Adapter parity:** 通过 Eve `writeBinaryFile()` 写入 XLSX，随后以 Bash `ls`/`sha256sum` 和 just-bash custom command 读取；三者必须看到同一路径和相同字节。
2. **Adapter parity:** 验证 `spawn()` 的 stdout/stderr stream、exit code、`kill()` 与 abort signal，不可只以 buffered `exec()` 替代。
3. 创建 sandbox，写入一份 XLSX fixture，运行 `xlsx sheets`，确认返回 worksheet 名称。
4. 运行 `xlsx export ... --format json`，确认 workbook 值从虚拟 filesystem 返回为 JSON。
5. 写入并执行 Bash/awk 脚本，确认可读写 `/workspace/analysis/`。
6. 关闭并重新创建同一 session key，确认 workspace 文件仍存在。
7. 通过 Eve 工具链运行一次 `bash`，确认模型可用的通用 sandbox 工具不再被禁用。

## Guardrails

- `xlsx` 拒绝非 `.xlsx` 输入、未知命令、缺失 sheet、无效 range 和不支持的输出格式。
- `xlsx` 不读取 `/workspace` 以外的路径。
- `npm run typecheck` 与 `npm run build:eve` 必须通过。
