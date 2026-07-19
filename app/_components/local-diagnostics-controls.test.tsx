// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalDiagnosticsControls, LocalSessionSidebar } from "./local-diagnostics-controls";

describe("LocalDiagnosticsControls", () => {
  it("renders local sessions in the left sidebar and filters them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      sessions: [{ sessionId: "wrun_01KXV0C35TRVNV8BPN8XZG96TD", updatedAt: "2026-07-19T01:02:03.000Z" }],
      source: "eve-local-run-manifests",
      truncated: false,
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<LocalSessionSidebar currentSessionId="wrun_01KXV0C35TRVNV8BPN8XZG96TD" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/local/sessions", { cache: "no-store" });
    });
    expect(await screen.findByText("wrun_01KXV0C35...PN8XZG96TD")).toBeTruthy();
    expect(screen.queryByText("continuationToken")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search chats" }), { target: { value: "does-not-match" } });
    expect(screen.getByText("No chats match this search.")).toBeTruthy();
  });

  it("shows a read-only MicroSandbox snapshot and refreshes it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      generatedAt: "2026-07-19T01:02:03.000Z",
      eve: { reachable: true, model: "openai/gpt-5.4", sandboxBackend: "microsandbox", toolNames: ["query_table"], skillNames: [] },
      microsandbox: {
        runningSandboxCount: 1,
        eveManagedSandboxCount: 1,
        mappingStatus: "heuristic",
        sandboxes: [{ name: "eve-sbx-ses-demo", cpuPercent: 1.2, memoryBytes: 3 * 1024 * 1024, uptimeMs: 65_000, timestamp: "2026-07-19T01:02:03.000Z" }],
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<LocalDiagnosticsControls />);

    fireEvent.click(screen.getByRole("button", { name: "Open local runtime status" }));
    expect(await screen.findByText("eve-sbx-ses-demo")).toBeTruthy();
    expect(screen.getByText("1.2%")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /stop|delete|restart/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Refresh local runtime status" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

function renderWithProviders(node: React.ReactNode) {
  return render(<TooltipProvider>{node}</TooltipProvider>);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}
