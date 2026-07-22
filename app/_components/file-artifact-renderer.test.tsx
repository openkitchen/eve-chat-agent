// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { describe, expect, it } from "vitest";
import { AgentMessage } from "./agent-message";
import { FileArtifactRenderer, hasFileArtifactRenderer } from "./file-artifact-renderer";

describe("FileArtifactRenderer", () => {
  it("renders a download only from a validated download_table output", () => {
    const part = downloadPart();
    expect(hasFileArtifactRenderer(part)).toBe(true);
    render(<FileArtifactRenderer part={part} />);

    const link = screen.getByRole("link", { name: "Download open-orders.csv" });
    expect(link.getAttribute("download")).toBe("open-orders.csv");
    expect(link.getAttribute("href")).toContain("data:text/csv;base64,");
  });

  it("renders a validated multi-series draw_chart payload", () => {
    const part = drawPart();
    expect(hasFileArtifactRenderer(part)).toBe(true);
    render(<FileArtifactRenderer part={part} />);
    expect(screen.getByRole("img", { name: "Regional revenue" })).toBeTruthy();
  });

  it("does not render a special artifact for malformed or unsuccessful output", () => {
    expect(hasFileArtifactRenderer({ ...drawPart({ invalid: true }), state: "output-error" } as EveDynamicToolPart)).toBe(false);
    expect(hasFileArtifactRenderer(drawPart({ invalid: true }))).toBe(false);
  });

  it("suppresses sandbox-only materialize_table output while marking it as a handled tool", () => {
    const part = materializePart();
    expect(hasFileArtifactRenderer(part)).toBe(true);
    const { container } = render(<FileArtifactRenderer part={part} />);
    expect(container.innerHTML).toBe("");
  });

  it("keeps draw_chart details collapsed while the chart stays visible", () => {
    const message = { id: "message_1", parts: [drawPart()], role: "assistant" } as EveMessage;
    const { container } = render(<AgentMessage canRespond={false} isStreaming={false} message={message} onInputResponses={() => undefined} />);
    expect(within(container).getByRole("img", { name: "Regional revenue" })).toBeTruthy();
    expect(within(container).getByRole("button", { name: /draw_chart/i }).getAttribute("data-state")).toBe("closed");
  });

  it("keeps draw_chart details collapsed when the output becomes available", async () => {
    const pendingMessage = { id: "message_2", parts: [{ ...drawPart(), output: undefined, state: "input-available" }], role: "assistant" } as EveMessage;
    const { container, rerender } = render(
      <AgentMessage canRespond={false} isStreaming message={pendingMessage} onInputResponses={() => undefined} />,
    );
    const toolButton = () => within(container).getByRole("button", { name: /draw_chart/i });
    expect(toolButton().getAttribute("data-state")).toBe("closed");

    rerender(<AgentMessage canRespond isStreaming={false} message={{ ...pendingMessage, parts: [drawPart()] }} onInputResponses={() => undefined} />);
    await waitFor(() => expect(toolButton().getAttribute("data-state")).toBe("closed"));
  });
});

function downloadPart(): EveDynamicToolPart {
  return {
    input: {},
    output: {
      dataUrl: "data:text/csv;base64,c3RhdHVzCm9wZW4K",
      filename: "open-orders.csv",
      mediaType: "text/csv",
      rowCount: 1,
      table: { range: "A1:A2", sheetName: "CSV", tableId: "table_1" },
    },
    state: "output-available",
    toolCallId: "call_download",
    toolName: "download_table",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}

function drawPart(output: unknown = drawOutput()): EveDynamicToolPart {
  return {
    input: {},
    output,
    state: "output-available",
    toolCallId: "call_draw",
    toolName: "draw_chart",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}

function materializePart(): EveDynamicToolPart {
  return {
    input: {},
    output: {
      format: "csv",
      path: "/workspace/analysis/input/table_1.csv",
      schema: [{ name: "month", type: "date" }],
    },
    state: "output-available",
    toolCallId: "call_materialize",
    toolName: "materialize_table",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}

function drawOutput() {
  return {
    data: [
      { APAC: 120, EMEA: 100, month: "2026-01" },
      { APAC: 150, EMEA: 110, month: "2026-02" },
    ],
    provenance: { kind: "sandbox-derived", rowCount: 2 },
    spec: {
      renderer: "recharts-cartesian-v1",
      title: "Regional revenue",
      chart: { type: "line" },
      xAxis: { dataKey: "month" },
      series: [
        { dataKey: "APAC", type: "line" },
        { dataKey: "EMEA", type: "line" },
      ],
    },
  };
}
