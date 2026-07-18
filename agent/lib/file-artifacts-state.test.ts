import { describe, expect, it } from "vitest";
import { FILE_ARTIFACT_LIMITS, type Column } from "../../lib/file-artifacts/contracts";
import { assertFileArtifactsCapacity, type FileArtifactsState, type StoredTable } from "./file-artifacts-state";

const emptyState: FileArtifactsState = { attachments: {}, tables: {} };

describe("file artifact session capacity", () => {
  it("rejects table, row, and cell totals before state is updated", () => {
    expect(() =>
      assertFileArtifactsCapacity(
        emptyState,
        Array.from({ length: FILE_ARTIFACT_LIMITS.sessionTablesMax + 1 }, (_, index) => table(`table_${index}`, 1, 1)),
      ),
    ).toThrow("table POC limit");

    expect(() => assertFileArtifactsCapacity(emptyState, [table("too_many_rows", FILE_ARTIFACT_LIMITS.sessionRowsMax + 1, 1)])).toThrow("row POC limit");

    expect(() => assertFileArtifactsCapacity(emptyState, [table("too_many_cells", FILE_ARTIFACT_LIMITS.sessionRowsMax, 21)])).toThrow("cell POC limit");

    expect(() =>
      assertFileArtifactsCapacity(
        emptyState,
        [table("too_many_bytes", 1, 1, "x".repeat(FILE_ARTIFACT_LIMITS.sessionBytesMax))],
      ),
    ).toThrow("serialized-byte POC limit");
  });
});

function table(tableId: string, rowCount: number, columnCount: number, value = "value"): StoredTable {
  const columns: Column[] = Array.from({ length: columnCount }, (_, index) => ({ name: `column_${index + 1}`, type: "string" }));
  return {
    columns,
    rows: Array.from({ length: rowCount }, () => Object.fromEntries(columns.map((column) => [column.name, value]))),
    table: { range: "A1", sheetName: "CSV", tableId },
  };
}
