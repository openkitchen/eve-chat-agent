import { describe, expect, it } from "vitest";
import { readSessionId, recoverEveSession } from "./session-recovery";

describe("session recovery", () => {
  it("accepts a workflow session ID only from session_id", () => {
    expect(readSessionId("?session_id=wrun_01KXV0C35TRVNV8BPN8XZG96TD")).toBe("wrun_01KXV0C35TRVNV8BPN8XZG96TD");
    expect(readSessionId("?session_id=../../etc/passwd")).toBeUndefined();
    expect(readSessionId("?session=wrun_01KXV0C35TRVNV8BPN8XZG96TD")).toBeUndefined();
  });

  it("replays the event log and resumes from the latest waiting cursor", () => {
    const recovered = recoverEveSession(
      "wrun_01KXV0C35TRVNV8BPN8XZG96TD",
      [
        JSON.stringify({ data: { sequence: 0, turnId: "turn_0" }, type: "turn.started" }),
        JSON.stringify({ data: { continuationToken: "eve:old-token" }, type: "session.waiting" }),
        JSON.stringify({ data: { sequence: 1, turnId: "turn_1" }, type: "turn.started" }),
        JSON.stringify({ data: { continuationToken: "eve:current-token" }, type: "session.waiting" }),
      ].join("\n"),
    );

    expect(recovered.initialEvents).toHaveLength(4);
    expect(recovered.initialSession).toEqual({
      continuationToken: "eve:current-token",
      sessionId: "wrun_01KXV0C35TRVNV8BPN8XZG96TD",
      streamIndex: 4,
    });
  });

  it("does not create a resumable cursor for a session without session.waiting", () => {
    expect(() =>
      recoverEveSession(
        "wrun_01KXV0C35TRVNV8BPN8XZG96TD",
        JSON.stringify({ data: { sequence: 0, turnId: "turn_0" }, type: "turn.started" }),
      ),
    ).toThrow("not ready");
  });
});
