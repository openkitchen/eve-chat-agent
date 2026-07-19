import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Sandbox, Snapshot } from "microsandbox";
import { afterEach, describe, expect, it } from "vitest";
import sandboxDefinition from "../sandbox";

const temporaryRoots: string[] = [];
const createdSandboxNames = new Set<string>();
const snapshotNamesBefore = new Set<string>();

afterEach(async () => {
  await Promise.all([...createdSandboxNames].map(async (name) => {
    const sandbox = await Sandbox.get(name).catch(() => undefined);
    await sandbox?.stopWithTimeout(1_000).catch(() => undefined);
    await sandbox?.remove().catch(() => undefined);
  }));
  createdSandboxNames.clear();
  const snapshots = await Snapshot.list();
  await Promise.all(snapshots
    .filter((snapshot) => snapshot.name !== null && !snapshotNamesBefore.has(snapshot.name))
    .map((snapshot) => snapshot.remove({ force: true }).catch(() => undefined)));
  snapshotNamesBefore.clear();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("MicroSandbox backend", () => {
  it("builds a reusable Eve template with Python data analysis and preserves a live session workspace", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "eve-microsandbox-"));
    temporaryRoots.push(appRoot);
    for (const snapshot of await Snapshot.list()) {
      if (snapshot.name) snapshotNamesBefore.add(snapshot.name);
    }

    const backend = typeof sandboxDefinition.backend === "function"
      ? sandboxDefinition.backend()
      : sandboxDefinition.backend;
    if (!backend) throw new Error("MicroSandbox backend is not configured.");
    const templateKey = `microsandbox-test-${randomUUID()}`;
    await backend.prewarm({
      bootstrap: sandboxDefinition.bootstrap,
      runtimeContext: { appRoot },
      seedFiles: [],
      templateKey,
    });

    const first = await backend.create({
      runtimeContext: { appRoot },
      sessionKey: "session-1",
      templateKey,
    });
    const session = await first.useSessionFn();
    const doctor = await session.run({
      command: "python3 -c 'import csv, sqlite3; print(sqlite3.sqlite_version)'",
    });
    expect(doctor.exitCode, doctor.stderr).toBe(0);
    expect(doctor.stdout.trim()).not.toBe("");

    const workbook = await session.run({
      command: "python3 -c \"import csv, sqlite3; rows=[('2026-01', 12), ('2026-02', 18)]; db=sqlite3.connect(':memory:'); db.execute('create table orders(month text, amount integer)'); db.executemany('insert into orders values (?, ?)', rows); result=db.execute('select sum(amount) from orders').fetchone()[0]; csv.writer(open('/workspace/analysis/derived.csv', 'w', newline='')).writerows([['month','amount'], *rows]); print(result)\"",
    });
    expect(workbook.exitCode, workbook.stderr).toBe(0);
    expect(workbook.stdout).toBe("30\n");
    const sentinelWrite = await session.run({ command: "printf 'persisted\\n' > /workspace/analysis/sentinel.txt && sync" });
    expect(sentinelWrite.exitCode, sentinelWrite.stderr).toBe(0);
    const nextTurnSession = await first.useSessionFn();
    expect(await nextTurnSession.readTextFile({ path: "/workspace/analysis/sentinel.txt" })).toBe("persisted\n");
    const state = await first.captureState();
    registerSandbox(state.metadata);
    await first.shutdown();
  }, 120_000);
});

function registerSandbox(metadata: Record<string, unknown>) {
  const sandboxName = metadata.sandboxName;
  if (typeof sandboxName === "string") createdSandboxNames.add(sandboxName);
}
