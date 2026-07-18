// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDebugIdentifiers, SessionDiagnostics } from "./session-diagnostics";

describe("SessionDiagnostics", () => {
  it("uses the workflow session ID as the run ID and copies only those stable identifiers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
        <TooltipProvider>
          <SessionDiagnostics
          sessionId="wrun_01KXTWRYKQA4FM6FCKGJD7WG4Z"
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy Eve debug identifiers" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "sessionId: wrun_01KXTWRYKQA4FM6FCKGJD7WG4Z\nrunId: wrun_01KXTWRYKQA4FM6FCKGJD7WG4Z",
      );
    });
  });

  it("formats the stable identifiers without a turn ID", () => {
    expect(formatDebugIdentifiers({ sessionId: "wrun_1" })).toBe("sessionId: wrun_1\nrunId: wrun_1");
  });
});
