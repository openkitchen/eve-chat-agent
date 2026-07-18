import type { HandleMessageStreamEvent, SessionState } from "eve/client";

export type RecoveredEveSession = {
  readonly initialEvents: readonly HandleMessageStreamEvent[];
  readonly initialSession: SessionState;
};

export function readSessionId(search: string): string | undefined {
  const sessionId = new URLSearchParams(search).get("session_id")?.trim();
  return sessionId && /^wrun_[A-Za-z0-9]+$/.test(sessionId) ? sessionId : undefined;
}

export function recoverEveSession(sessionId: string, ndjson: string): RecoveredEveSession {
  return recoverEveSessionEvents(sessionId, parseNdjsonEvents(ndjson));
}

export function recoverEveSessionEvents(
  sessionId: string,
  initialEvents: readonly HandleMessageStreamEvent[],
): RecoveredEveSession {
  const continuationToken = latestContinuationToken(initialEvents);
  if (!continuationToken) {
    throw new Error("This session is not ready to receive another message.");
  }
  return {
    initialEvents,
    initialSession: {
      continuationToken,
      sessionId,
      streamIndex: initialEvents.length,
    },
  };
}

export async function fetchRecoveredEveSession(sessionId: string): Promise<RecoveredEveSession> {
  const response = await fetch(`/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Unable to restore this session (${response.status}).`);
  }
  if (!response.body) {
    throw new Error("The session stream did not include a response body.");
  }
  return recoverEveSessionEvents(sessionId, await readReplayEvents(response.body));
}

function parseNdjsonEvents(ndjson: string): HandleMessageStreamEvent[] {
  return ndjson
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as HandleMessageStreamEvent);
}

async function readReplayEvents(stream: ReadableStream<Uint8Array>): Promise<HandleMessageStreamEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: HandleMessageStreamEvent[] = [];
  let pending = "";
  try {
    while (true) {
      const read = reader.read().then((result) => ({ kind: "read" as const, result }));
      const next =
        events.length === 0
          ? await read
          : await Promise.race([read, waitForReplayIdle().then(() => ({ kind: "idle" as const }))]);
      if (next.kind === "idle") {
        await reader.cancel();
        break;
      }
      if (next.result.done) {
        pending += decoder.decode();
        break;
      }
      pending += decoder.decode(next.result.value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim() !== "") {
          events.push(JSON.parse(line) as HandleMessageStreamEvent);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (pending.trim() !== "") {
    events.push(JSON.parse(pending) as HandleMessageStreamEvent);
  }
  return events;
}

function waitForReplayIdle(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 250));
}

export function replaceSessionUrl(sessionId: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("session_id") === sessionId) {
    return;
  }
  url.searchParams.set("session_id", sessionId);
  window.history.replaceState(null, "", url);
}

function latestContinuationToken(events: readonly HandleMessageStreamEvent[]): string | undefined {
  for (const event of [...events].reverse()) {
    if (
      event.type === "session.waiting" &&
      typeof event.data.continuationToken === "string" &&
      event.data.continuationToken.length > 0
    ) {
      return event.data.continuationToken;
    }
  }
  return undefined;
}
