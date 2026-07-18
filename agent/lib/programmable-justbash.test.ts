import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { programmableJustbash } from "./programmable-justbash";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("programmable just-bash", () => {
  it("keeps Eve files, shell commands, virtual commands, and script runtimes in one workspace", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "eve-programmable-justbash-"));
    temporaryRoots.push(appRoot);
    const backend = programmableJustbash();
    const input = { runtimeContext: { appRoot }, sessionKey: "session-1", templateKey: null };
    const first = await backend.create(input);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales");
    sheet.addRows([["created_at", "amount"], [new Date("2026-01-05T00:00:00.000Z"), 12], [new Date("2026-02-10T00:00:00.000Z"), 18]]);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    await first.session.writeBinaryFile({ content: bytes, path: "/workspace/attachments/report.xlsx" });

    const shell = await first.session.run({ command: "ls /workspace/attachments && sha256sum /workspace/attachments/report.xlsx" });
    expect(shell.exitCode, shell.stderr).toBe(0);
    expect(shell.stdout).toContain("report.xlsx");
    const process = await first.session.spawn({ command: "echo stdout; echo stderr >&2" });
    const [stdout, stderr, exit] = await Promise.all([readStream(process.stdout), readStream(process.stderr), process.wait()]);
    expect({ exitCode: exit.exitCode, stderr, stdout }).toEqual({ exitCode: 0, stderr: "stderr\n", stdout: "stdout\n" });
    const sheets = await first.session.run({ command: "xlsx sheets /workspace/attachments/report.xlsx" });
    expect(sheets.exitCode, sheets.stderr).toBe(0);
    expect(JSON.parse(sheets.stdout)).toEqual([{ name: "Sales", rowCount: 3, columnCount: 2 }]);

    const exportResult = await first.session.run({ command: "xlsx export /workspace/attachments/report.xlsx --sheet Sales --range A1:B3 --format json > /workspace/analysis/sales.json" });
    expect(exportResult.exitCode, exportResult.stderr).toBe(0);
    expect(JSON.parse((await first.session.readTextFile({ path: "/workspace/analysis/sales.json" })) ?? "")).toEqual([
      { created_at: "2026-01-05T00:00:00.000Z", amount: 12 },
      { created_at: "2026-02-10T00:00:00.000Z", amount: 18 },
    ]);

    expect((await first.session.run({ command: "awk 'END { print NR }' /workspace/analysis/sales.json" })).stdout.trim()).toBe("10");

    await first.captureState();
    await first.shutdown();
    const resumed = await backend.create(input);
    expect(await resumed.session.readTextFile({ path: "/workspace/analysis/sales.json" })).toContain("created_at");
    await resumed.shutdown();
  });
});

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
