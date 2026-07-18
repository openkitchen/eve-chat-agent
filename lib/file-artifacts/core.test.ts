import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { FILE_ARTIFACT_LIMITS } from "./contracts";
import type { StoredTableData } from "./core";
import { exportStoredTable, parseAttachment, publishDerivedChart, queryStoredTable } from "./core";

const ids = () => {
  let count = 0;
  return () => `table_${++count}`;
};

describe("file artifact parsing", () => {
  it("normalizes CSV types and returns a stable line-chart query", async () => {
    const parsed = await parseAttachment(
      new TextEncoder().encode(
        [
          "order_id,amount,status,created_at",
          "o-001,120.5,open,2026-01-01",
          "o-002,88,closed,2026-01-02",
          "o-003,240,open,2026-01-03",
        ].join("\n"),
      ),
      "orders.csv",
      ids(),
    );
    const candidate = parsed.candidates[0]!;
    expect(candidate.candidate.columns).toEqual([
      { name: "order_id", type: "string" },
      { name: "amount", type: "number" },
      { name: "status", type: "string" },
      { name: "created_at", type: "date" },
    ]);

    const table = toStoredTable(candidate);
    const output = queryStoredTable(
      table,
      { columns: ["created_at", "amount"], limit: 50, type: "rows" },
      { kind: "line", type: "chart", x: "created_at", y: "amount" },
    );
    expect(output.ordering).toBe("source-row");
    expect(output.rows).toEqual([
      { amount: 120.5, created_at: "2026-01-01" },
      { amount: 88, created_at: "2026-01-02" },
      { amount: 240, created_at: "2026-01-03" },
    ]);
  });

  it("discovers offset dense XLSX tables and keeps the source title in the range", async () => {
    const bytes = await readFile(new URL("../../test/fixtures/file-artifacts/report.xlsx", import.meta.url));
    const parsed = await parseAttachment(bytes, "report.xlsx", ids());
    expect(parsed.candidates.map((table) => table.candidate.range)).toEqual(["B4:E9", "H4:K8"]);
    expect(parsed.candidates.map((table) => table.candidate.headerRow)).toEqual([5, 5]);
    expect(parsed.candidates.map((table) => table.candidate.rowCount)).toEqual([4, 3]);
    expect(parsed.warnings).toEqual([
      "Report B4:E9: the first row was treated as a title; header row is 5.",
      "Report H4:K8: the first row was treated as a title; header row is 5.",
    ]);
  });

  it("rejects CSV and XLSX inputs before an oversized table can be stored", async () => {
    const csv = [
      "value",
      ...Array.from({ length: FILE_ARTIFACT_LIMITS.sourceRowsMax + 1 }, () => "1"),
    ].join("\n");
    await expect(parseAttachment(new TextEncoder().encode(csv), "oversized.csv", ids())).rejects.toThrow("row POC limit");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Oversized");
    worksheet.getCell(1, 1).value = "value";
    worksheet.getCell(FILE_ARTIFACT_LIMITS.sourceRowsMax + 3, 1).value = "1";
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    await expect(parseAttachment(bytes, "oversized.xlsx", ids())).rejects.toThrow("row POC limit");
  });
});

describe("file artifact queries and exports", () => {
  it("returns deterministic group and histogram result schemas", () => {
    const table: StoredTableData = {
      columns: [
        { name: "status", type: "string" },
        { name: "amount", type: "number" },
      ],
      rows: [
        { amount: 120, status: "open" },
        { amount: 80, status: "closed" },
        { amount: 240, status: "open" },
      ],
      table: { range: "A1:B4", sheetName: "CSV", tableId: "table_orders" },
    };
    const grouped = queryStoredTable(
      table,
      { aggregate: { op: "sum", column: "amount" }, groupBy: "status", limit: 20, type: "group_by" },
      { kind: "bar", type: "chart", x: "status", y: "value" },
    );
    expect(grouped.ordering).toBe("first-occurrence");
    expect(grouped.resultColumns).toEqual([{ name: "status", type: "string" }, { name: "value", type: "number" }]);
    expect(grouped.rows).toEqual([{ status: "open", value: 360 }, { status: "closed", value: 80 }]);

    const histogram = queryStoredTable(
      table,
      { bins: 5, column: "amount", type: "histogram" },
      { kind: "histogram", type: "chart", x: "amount" },
    );
    expect(histogram.ordering).toBe("ascending-bin");
    expect(histogram.rows).toHaveLength(5);
    expect(histogram.rows.reduce((total, bin) => total + Number(bin.count), 0)).toBe(3);
  });

  it("escapes spreadsheet formulas and fails instead of truncating oversized exports", () => {
    const table: StoredTableData = {
      columns: [{ name: '=HYPERLINK("https://example.test")', type: "string" }],
      rows: [{ '=HYPERLINK("https://example.test")': "=SUM(A1:A2)" }],
      table: { range: "A1:A2", sheetName: "CSV", tableId: "table_formula" },
    };
    const exportFile = exportStoredTable(table, { type: "rows" }, "csv", "formula.csv");
    const csv = new TextDecoder().decode(exportFile.bytes);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'=SUM(A1:A2)");

    const tooLarge: StoredTableData = {
      ...table,
      rows: Array.from({ length: 501 }, (_, index) => ({ value: String(index) })),
    };
    expect(() => exportStoredTable(tooLarge, { type: "rows" }, "csv")).toThrow("export_limit_exceeded");
  });

  it("publishes a bounded, typed derived chart without exposing its sandbox filename", async () => {
    const sourceTable: StoredTableData = {
      columns: [
        { name: "created_at", type: "date" },
        { name: "amount", type: "number" },
      ],
      rows: [{ amount: 120, created_at: "2026-01-01" }],
      table: { range: "A1:B2", sheetName: "CSV", tableId: "table_orders" },
    };
    const output = await publishDerivedChart(
      new TextEncoder().encode("month,total_amount\n2026-01,7047.28\n2026-02,5689.43\n"),
      sourceTable,
      { kind: "line", title: "Monthly order amount", type: "chart", x: "month", y: "total_amount" },
    );

    expect(output).toEqual({
      provenance: {
        kind: "sandbox-derived",
        sourceTable: sourceTable.table,
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
      view: { kind: "line", title: "Monthly order amount", type: "chart", x: "month", y: "total_amount" },
    });
  });

  it("rejects an invalid derived chart before it can reach the UI", async () => {
    const sourceTable: StoredTableData = {
      columns: [],
      rows: [],
      table: { range: "A1", sheetName: "CSV", tableId: "table_orders" },
    };
    await expect(
      publishDerivedChart(
        new TextEncoder().encode("month,total_amount\n2026-01,not-a-number\n"),
        sourceTable,
        { kind: "line", type: "chart", x: "month", y: "total_amount" },
      ),
    ).rejects.toThrow("chart y column must be numeric");
  });
});

function toStoredTable(parsed: Awaited<ReturnType<typeof parseAttachment>>["candidates"][number]): StoredTableData {
  return {
    columns: parsed.candidate.columns,
    rows: parsed.rows,
    table: {
      range: parsed.candidate.range,
      sheetName: parsed.candidate.sheetName,
      tableId: parsed.candidate.tableId,
    },
  };
}
