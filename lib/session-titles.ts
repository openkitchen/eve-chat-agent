import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SESSION_ID = /^wrun_[A-Za-z0-9]+$/;
const TITLE_MAX_LENGTH = 80;
const FALLBACK_TITLE = "New chat";

type SessionTitleRecord = {
  readonly source?: "fallback" | "model";
  readonly title: string;
};

export function defaultSessionTitleDirectory(): string {
  return join(process.cwd(), ".eve", "local-session-titles");
}

export async function readSessionTitle(sessionId: string, directory = defaultSessionTitleDirectory()): Promise<string | undefined> {
  return (await readSessionTitleRecord(sessionId, directory))?.title;
}

export async function ensureFallbackSessionTitle(
  sessionId: string,
  directory = defaultSessionTitleDirectory(),
): Promise<{ readonly title: string; readonly written: boolean }> {
  if (!SESSION_ID.test(sessionId)) {
    throw new Error("Session title can only be stored for an Eve workflow session.");
  }

  const existing = await readSessionTitleRecord(sessionId, directory);
  if (existing) {
    return { title: existing.title, written: false };
  }

  await writeSessionTitleRecord(sessionId, { source: "fallback", title: FALLBACK_TITLE }, directory);
  return { title: FALLBACK_TITLE, written: true };
}

export async function writeSessionTitle(
  sessionId: string,
  title: string,
  directory = defaultSessionTitleDirectory(),
): Promise<{ readonly title: string; readonly written: boolean }> {
  if (!SESSION_ID.test(sessionId)) {
    throw new Error("Session title can only be stored for an Eve workflow session.");
  }
  const normalized = normalizeTitle(title);
  if (!normalized) {
    throw new Error("Session title must contain visible text.");
  }
  const existing = await readSessionTitleRecord(sessionId, directory);
  if (existing?.source !== "fallback") {
    return { title: existing?.title ?? normalized, written: false };
  }

  await writeSessionTitleRecord(sessionId, { source: "model", title: normalized }, directory);
  return { title: normalized, written: true };
}

async function readSessionTitleRecord(
  sessionId: string,
  directory: string,
): Promise<SessionTitleRecord | undefined> {
  if (!SESSION_ID.test(sessionId)) return undefined;
  try {
    const content = await readFile(join(directory, `${sessionId}.json`), "utf8");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || !("title" in parsed)) return undefined;
    const title = normalizeTitle(parsed.title);
    if (!title) return undefined;
    const source = "source" in parsed && (parsed.source === "fallback" || parsed.source === "model")
      ? parsed.source
      : "model";
    return { source, title };
  } catch {
    return undefined;
  }
}

async function writeSessionTitleRecord(sessionId: string, record: SessionTitleRecord, directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const destination = join(directory, `${sessionId}.json`);
  const temporary = join(directory, `.${sessionId}.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(record)}\n`, "utf8");
  await rename(temporary, destination);
}

function normalizeTitle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const title = value.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX_LENGTH);
  return title.length > 0 ? title : undefined;
}
