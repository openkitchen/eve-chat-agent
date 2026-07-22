import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureFallbackSessionTitle, readSessionTitle, writeSessionTitle } from "./session-titles";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { force: true, recursive: true });
  }));
});

describe("session titles", () => {
  it("replaces the server fallback with the first normalized model title", async () => {
    const root = await mkdtemp(join(tmpdir(), "eve-session-titles-"));
    temporaryRoots.push(root);

    await expect(ensureFallbackSessionTitle("wrun_01ABC", root)).resolves.toEqual({
      title: "New chat",
      written: true,
    });
    await expect(ensureFallbackSessionTitle("wrun_01ABC", root)).resolves.toEqual({
      title: "New chat",
      written: false,
    });
    await expect(writeSessionTitle("wrun_01ABC", "  Regional\nrevenue trend  ", root)).resolves.toEqual({
      title: "Regional revenue trend",
      written: true,
    });
    await expect(writeSessionTitle("wrun_01ABC", "Different title", root)).resolves.toEqual({
      title: "Regional revenue trend",
      written: false,
    });
    await expect(readSessionTitle("wrun_01ABC", root)).resolves.toBe("Regional revenue trend");
  });

  it("preserves title metadata created before fallback titles existed", async () => {
    const root = await mkdtemp(join(tmpdir(), "eve-session-titles-"));
    temporaryRoots.push(root);
    const { writeFile } = await import("node:fs/promises");

    await writeFile(join(root, "wrun_01LEGACY.json"), '{"title":"Existing chat"}\n', "utf8");

    await expect(ensureFallbackSessionTitle("wrun_01LEGACY", root)).resolves.toEqual({
      title: "Existing chat",
      written: false,
    });
    await expect(writeSessionTitle("wrun_01LEGACY", "Different title", root)).resolves.toEqual({
      title: "Existing chat",
      written: false,
    });
  });

  it("rejects invalid session IDs and ignores missing title records", async () => {
    const root = await mkdtemp(join(tmpdir(), "eve-session-titles-"));
    temporaryRoots.push(root);

    await expect(writeSessionTitle("not-a-session", "Title", root)).rejects.toThrow("Eve workflow session");
    await expect(readSessionTitle("wrun_01MISSING", root)).resolves.toBeUndefined();
  });
});
