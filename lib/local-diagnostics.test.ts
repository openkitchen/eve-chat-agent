import { mkdtemp, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isLocalDiagnosticsRequest, listLocalSessions, readLocalRuntime } from "./local-diagnostics";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { force: true, recursive: true });
  }));
});

describe("local diagnostics", () => {
  it("lists only local Eve run manifests in recent-first order", async () => {
    const root = await mkdtemp(join(tmpdir(), "eve-local-sessions-"));
    temporaryRoots.push(root);
    const oldPath = join(root, "wrun_OLD.json");
    const newPath = join(root, "wrun_NEW.json");
    await Promise.all([
      writeFile(oldPath, "{}"),
      writeFile(newPath, "{}"),
      writeFile(join(root, "not-a-session.json"), "{}"),
    ]);
    await symlink(newPath, join(root, "wrun_LINK.json"));
    await utimes(oldPath, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
    await utimes(newPath, new Date("2026-01-02T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z"));

    await expect(listLocalSessions(root)).resolves.toEqual({
      sessions: [
        { sessionId: "wrun_NEW", updatedAt: "2026-01-02T00:00:00.000Z" },
        { sessionId: "wrun_OLD", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      source: "eve-local-run-manifests",
      truncated: false,
    });
  });

  it("returns an empty index when Eve has not persisted sessions", async () => {
    await expect(listLocalSessions(join(tmpdir(), "missing-eve-local-sessions"))).resolves.toEqual({
      sessions: [],
      source: "eve-local-run-manifests",
      truncated: false,
    });
  });

  it("projects only the allowlisted Eve and MicroSandbox runtime fields", async () => {
    const response = await readLocalRuntime({
      fetchInfo: async () => ({
        agent: { model: { id: "openai/gpt-5.4" } },
        sandbox: { backend: "microsandbox" },
        skills: { static: [{ name: "tabular-analysis", secret: "never-project" }] },
        tools: { available: [{ name: "query_table", prompt: "never-project" }] },
      }),
      getMetrics: async () => ({
        "eve-sbx-ses-demo": {
          cpuPercent: 3.5,
          memoryBytes: 12_345_678,
          timestamp: new Date("2026-01-02T03:04:05.000Z"),
          uptimeMs: 2_000,
        },
      }),
      now: () => new Date("2026-01-02T03:04:06.000Z"),
    });

    expect(response).toEqual({
      eve: {
        model: "openai/gpt-5.4",
        reachable: true,
        sandboxBackend: "microsandbox",
        skillNames: ["tabular-analysis"],
        toolNames: ["query_table"],
      },
      generatedAt: "2026-01-02T03:04:06.000Z",
      microsandbox: {
        eveManagedSandboxCount: 1,
        mappingStatus: "heuristic",
        runningSandboxCount: 1,
        sandboxes: [{
          cpuPercent: 3.5,
          memoryBytes: 12_345_678,
          name: "eve-sbx-ses-demo",
          timestamp: "2026-01-02T03:04:05.000Z",
          uptimeMs: 2_000,
        }],
      },
    });
  });

  it("keeps Eve and MicroSandbox failures independent", async () => {
    const response = await readLocalRuntime({
      fetchInfo: async () => { throw new Error("sidecar unavailable"); },
      getMetrics: async () => { throw new Error("msb unavailable"); },
      now: () => new Date("2026-01-02T03:04:06.000Z"),
    });

    expect(response.eve).toEqual({ reachable: false, error: "unreachable" });
    expect(response.microsandbox).toEqual({
      error: "unavailable",
      eveManagedSandboxCount: null,
      mappingStatus: "unavailable",
      runningSandboxCount: 0,
      sandboxes: [],
    });
  });

  it("admits only local development requests", () => {
    expect(isLocalDiagnosticsRequest(new Request("http://127.0.0.1:3000/api/local/runtime", { headers: { host: "127.0.0.1:3000" } }))).toBe(true);
    expect(isLocalDiagnosticsRequest(new Request("http://127.0.0.1:3000/api/local/runtime", { headers: { host: "127.0.0.1:3000", "x-forwarded-for": "::ffff:127.0.0.1" } }))).toBe(true);
    expect(isLocalDiagnosticsRequest(new Request("http://example.test/api/local/runtime", { headers: { host: "example.test" } }))).toBe(false);
  });
});
