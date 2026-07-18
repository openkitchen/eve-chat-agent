// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { describe, expect, it } from "vitest";
import { AgentMessage } from "./agent-message";
import { FileArtifactRenderer, hasFileArtifactRenderer } from "./file-artifact-renderer";

describe("FileArtifactRenderer", () => {
  it("renders a validated table view and declines malformed output", () => {
    const part = tablePart({
      ordering: "source-row",
      query: { columns: ["status"], limit: 20, type: "rows" },
      resultColumns: [{ name: "status", type: "string" }],
      resultCount: 1,
      rows: [{ status: "open" }],
      sourceMatchedCount: 1,
      table: { range: "A1:A2", sheetName: "CSV", tableId: "table_1" },
      truncated: false,
      view: { title: "Open orders", type: "table" },
    });
    expect(hasFileArtifactRenderer(part)).toBe(true);
    render(<FileArtifactRenderer part={part} />);
    expect(screen.getByText("Open orders")).toBeTruthy();
    expect(screen.getByText("open")).toBeTruthy();

    expect(hasFileArtifactRenderer(tablePart({ invalid: true }))).toBe(false);
  });

  it("renders each supported chart and an export download from validated output", () => {
    const chartCases = [
      {
        output: queryOutput({
          rows: [{ amount: 120, created_at: "2026-01-01" }],
          view: { kind: "line", title: "Amount trend", type: "chart", x: "created_at", y: "amount" },
        }),
        title: "Amount trend",
      },
      {
        output: queryOutput({
          query: { aggregate: { op: "count" }, groupBy: "status", limit: 12, type: "group_by" },
          resultColumns: [{ name: "status", type: "string" }, { name: "value", type: "number" }],
          rows: [{ status: "open", value: 2 }],
          view: { kind: "bar", title: "Orders by status", type: "chart", x: "status", y: "value" },
        }),
        title: "Orders by status",
      },
      {
        output: queryOutput({
          query: { bins: 10, column: "amount", type: "histogram" },
          resultColumns: [
            { name: "binStart", type: "number" },
            { name: "binEnd", type: "number" },
            { name: "count", type: "number" },
          ],
          rows: [{ binEnd: 200, binStart: 100, count: 2 }],
          view: { kind: "histogram", title: "Amount distribution", type: "chart", x: "amount" },
        }),
        title: "Amount distribution",
      },
    ];

    for (const chart of chartCases) {
      const { unmount } = render(<FileArtifactRenderer part={tablePart(chart.output)} />);
      expect(screen.getByRole("img", { name: chart.title })).toBeTruthy();
      unmount();
    }

    render(<FileArtifactRenderer part={exportPart()} />);
    const link = screen.getByRole("link", { name: "Download open-orders.csv" });
    expect(link.getAttribute("download")).toBe("open-orders.csv");
    expect(link.getAttribute("href")).toContain("data:text/csv;base64,");
  });

  it("renders a derived chart only from a validated publish_derived_chart output", () => {
    const part = derivedChartPart({
      provenance: {
        kind: "sandbox-derived",
        sourceTable: { range: "A1:B101", sheetName: "CSV", tableId: "table_orders" },
      },
      resultColumns: [
        { name: "month", type: "string" },
        { name: "total_amount", type: "number" },
      ],
      resultCount: 2,
      rows: [
        { month: "2026-01", total_amount: 7047.28 },
        { month: "2026-02", total_amount: 5689.43 },
      ],
      truncated: false,
      view: { kind: "line", title: "Monthly totals", type: "chart", x: "month", y: "total_amount" },
    });
    expect(hasFileArtifactRenderer(part)).toBe(true);
    render(<FileArtifactRenderer part={part} />);
    expect(screen.getByRole("img", { name: "Monthly totals" })).toBeTruthy();
    expect(screen.getByText(/Sandbox-derived from CSV A1:B101/)).toBeTruthy();

    expect(hasFileArtifactRenderer(derivedChartPart({ invalid: true }))).toBe(false);
  });

  it("does not render a successful-looking card for an unsuccessful tool state", () => {
    const part = { ...tablePart(queryOutput()), state: "output-error" } as EveDynamicToolPart;
    expect(hasFileArtifactRenderer(part)).toBe(false);
    const { container } = render(<FileArtifactRenderer part={part} />);
    expect(container.innerHTML).toBe("");
  });

  it("opens a successful artifact tool by default", () => {
    const message = {
      id: "message_1",
      parts: [tablePart(queryOutput())],
      role: "assistant",
    } as EveMessage;
    render(
      <AgentMessage
        canRespond={false}
        isStreaming={false}
        message={message}
        onInputResponses={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /query_table/i }).getAttribute("data-state")).toBe("open");
  });

  it("opens an artifact when a streaming tool result becomes available", async () => {
    const pendingMessage = {
      id: "message_2",
      parts: [{ ...tablePart(undefined), state: "input-available" }],
      role: "assistant",
    } as EveMessage;
    const { container, rerender } = render(
      <AgentMessage canRespond={false} isStreaming message={pendingMessage} onInputResponses={() => undefined} />,
    );
    const toolButton = () => within(container).getByRole("button", { name: /query_table/i });
    expect(toolButton().getAttribute("data-state")).toBe("closed");

    rerender(
      <AgentMessage
        canRespond
        isStreaming={false}
        message={{ ...pendingMessage, parts: [tablePart(queryOutput())] }}
        onInputResponses={() => undefined}
      />,
    );
    await waitFor(() => {
      expect(toolButton().getAttribute("data-state")).toBe("open");
    });
  });
});

function tablePart(output: unknown): EveDynamicToolPart {
  return {
    input: {},
    output,
    state: "output-available",
    toolCallId: "call_1",
    toolName: "query_table",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}

function queryOutput(overrides: Record<string, unknown> = {}) {
  return {
    ordering: "source-row",
    query: { columns: ["status"], limit: 20, type: "rows" },
    resultColumns: [{ name: "status", type: "string" }],
    resultCount: 1,
    rows: [{ status: "open" }],
    sourceMatchedCount: 1,
    table: { range: "A1:A2", sheetName: "CSV", tableId: "table_1" },
    truncated: false,
    view: { title: "Open orders", type: "table" },
    ...overrides,
  };
}

function exportPart(): EveDynamicToolPart {
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
    toolCallId: "call_export",
    toolName: "export_table",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}

function derivedChartPart(output: unknown): EveDynamicToolPart {
  return {
    input: {},
    output,
    state: "output-available",
    toolCallId: "call_derived_chart",
    toolName: "publish_derived_chart",
    type: "dynamic-tool",
  } as EveDynamicToolPart;
}
