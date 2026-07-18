import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import {
  FILE_ARTIFACT_LIMITS,
  type Column,
  type DataView,
  type DerivedChartView,
  type ExportQuery,
  type Scalar,
  type TableCandidate,
  type TableQuery,
  type TableRef,
} from "./contracts";

type RawCell = boolean | Date | number | string | null;
type RawMatrix = RawCell[][];

export type ParsedTable = {
  candidate: TableCandidate;
  rows: Array<Record<string, Scalar>>;
  warning?: string;
};

export type ParsedAttachment = {
  candidates: ParsedTable[];
  format: "csv" | "xlsx";
  warnings: string[];
};

export type StoredTableData = {
  columns: Column[];
  rows: Array<Record<string, Scalar>>;
  table: TableRef;
};

type QueryResult = {
  ordering: "ascending-bin" | "first-occurrence" | "source-row";
  resultColumns: Column[];
  rows: Array<Record<string, Scalar>>;
  sourceMatchedCount: number;
  truncated: boolean;
};

const DECIMAL_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ISO_DATE_LITERAL = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/;

export async function parseAttachment(
  bytes: Uint8Array,
  filename: string,
  createTableId: () => string,
): Promise<ParsedAttachment> {
  if (bytes.byteLength > FILE_ARTIFACT_LIMITS.fileBytesMax) {
    throw new Error("Attachment exceeds the 10 MiB POC limit.");
  }
  const extension = filename.toLowerCase().split(".").at(-1);
  if (extension === "csv") {
    const text = new TextDecoder().decode(bytes);
    const rows = parseCsv(text, {
      bom: true,
      on_record(record, context) {
        if (context.records > FILE_ARTIFACT_LIMITS.sourceRowsMax + 1) {
          throw new Error(`CSV exceeds the ${FILE_ARTIFACT_LIMITS.sourceRowsMax}-row POC limit.`);
        }
        if (record.length > FILE_ARTIFACT_LIMITS.sourceColumnsMax) {
          throw new Error(`CSV exceeds the ${FILE_ARTIFACT_LIMITS.sourceColumnsMax}-column POC limit.`);
        }
        return record;
      },
      relax_column_count: true,
      skip_empty_lines: true,
    }) as string[][];
    if (rows.length === 0) {
      return { candidates: [], format: "csv", warnings: [] };
    }
    assertCsvCellsWithinLimit(rows);
    const table = buildTable({
      createTableId,
      matrix: rows.map((row) => row.map((cell) => (cell === "" ? null : cell))),
      rangeBounds: { bottom: rows.length, left: 1, right: Math.max(...rows.map((row) => row.length), 1), top: 1 },
      sheetName: "CSV",
    });
    return { candidates: table ? [table] : [], format: "csv", warnings: table?.warning ? [table.warning] : [] };
  }
  if (extension !== "xlsx") {
    throw new Error("Only CSV and XLSX attachments are supported.");
  }

  const workbook = new ExcelJS.Workbook();
  // exceljs declares an outdated global Buffer shape that conflicts with Node 24's generic Buffer.
  await workbook.xlsx.load(Buffer.from(bytes) as never);
  if (workbook.worksheets.length > 10) {
    throw new Error("Workbook exceeds the 10-sheet POC limit.");
  }

  const candidates: ParsedTable[] = [];
  const warnings: string[] = [];
  for (const worksheet of workbook.worksheets) {
    assertWorksheetWithinLimits(worksheet);
    const matrix = worksheetToMatrix(worksheet);
    for (const bounds of discoverDenseBlocks(matrix)) {
      const table = buildTable({ createTableId, matrix, rangeBounds: bounds, sheetName: worksheet.name });
      if (table) {
        assertTableWithinLimits(table);
        candidates.push(table);
        if (table.warning) {
          warnings.push(table.warning);
        }
      }
      if (candidates.length > 20) {
        throw new Error("Workbook exceeds the 20-table-candidate POC limit.");
      }
    }
  }
  return { candidates, format: "xlsx", warnings };
}

function assertCsvCellsWithinLimit(rows: string[][]) {
  const cellCount = rows.reduce((total, row) => total + row.length, 0);
  if (cellCount > FILE_ARTIFACT_LIMITS.sourceCellsMax) {
    throw new Error(`CSV exceeds the ${FILE_ARTIFACT_LIMITS.sourceCellsMax}-cell POC limit.`);
  }
}

function assertWorksheetWithinLimits(worksheet: ExcelJS.Worksheet) {
  if (worksheet.rowCount > FILE_ARTIFACT_LIMITS.sourceRowsMax + 2) {
    throw new Error(`Worksheet ${worksheet.name} exceeds the ${FILE_ARTIFACT_LIMITS.sourceRowsMax}-row POC limit.`);
  }
  if (worksheet.columnCount > FILE_ARTIFACT_LIMITS.sourceColumnsMax) {
    throw new Error(`Worksheet ${worksheet.name} exceeds the ${FILE_ARTIFACT_LIMITS.sourceColumnsMax}-column POC limit.`);
  }
  if (worksheet.rowCount * worksheet.columnCount > FILE_ARTIFACT_LIMITS.sourceCellsMax) {
    throw new Error(`Worksheet ${worksheet.name} exceeds the ${FILE_ARTIFACT_LIMITS.sourceCellsMax}-cell POC limit.`);
  }
}

function assertTableWithinLimits(table: ParsedTable) {
  if (table.rows.length > FILE_ARTIFACT_LIMITS.sourceRowsMax) {
    throw new Error(`Table ${table.candidate.sheetName} ${table.candidate.range} exceeds the ${FILE_ARTIFACT_LIMITS.sourceRowsMax}-row POC limit.`);
  }
  if (table.candidate.columns.length > FILE_ARTIFACT_LIMITS.sourceColumnsMax) {
    throw new Error(`Table ${table.candidate.sheetName} ${table.candidate.range} exceeds the ${FILE_ARTIFACT_LIMITS.sourceColumnsMax}-column POC limit.`);
  }
  if (table.rows.length * table.candidate.columns.length > FILE_ARTIFACT_LIMITS.sourceCellsMax) {
    throw new Error(`Table ${table.candidate.sheetName} ${table.candidate.range} exceeds the ${FILE_ARTIFACT_LIMITS.sourceCellsMax}-cell POC limit.`);
  }
}

export function queryStoredTable(table: StoredTableData, query: TableQuery, view?: DataView) {
  const result = runQuery(table, query);
  validateView(table, query, view, result.resultColumns);
  return {
    ordering: result.ordering,
    query,
    resultColumns: result.resultColumns,
    resultCount: result.rows.length,
    rows: result.rows,
    sourceMatchedCount: result.sourceMatchedCount,
    table: table.table,
    truncated: result.truncated,
    ...(view ? { view } : {}),
  };
}

export function exportStoredTable(table: StoredTableData, query: ExportQuery, format: "csv" | "json", requestedFilename?: string) {
  const result = runQuery(table, query);
  if (result.rows.length > FILE_ARTIFACT_LIMITS.exportRowsMax) {
    throw new Error(`export_limit_exceeded: more than ${FILE_ARTIFACT_LIMITS.exportRowsMax} rows matched.`);
  }
  const content = format === "csv" ? toCsv(result.rows, result.resultColumns) : JSON.stringify(result.rows, null, 2);
  const bytes = new TextEncoder().encode(content);
  if (bytes.byteLength > FILE_ARTIFACT_LIMITS.exportBytesMax) {
    throw new Error("export_limit_exceeded: export exceeds 1 MiB.");
  }
  const mediaType: "application/json" | "text/csv" = format === "csv" ? "text/csv" : "application/json";
  const extension = format === "csv" ? "csv" : "json";
  const filename = normalizeFilename(requestedFilename, extension);
  return { bytes, filename, mediaType, rowCount: result.rows.length };
}

export async function publishDerivedChart(
  bytes: Uint8Array,
  sourceTable: StoredTableData,
  view: DerivedChartView,
) {
  if (bytes.byteLength > FILE_ARTIFACT_LIMITS.derivedChartBytesMax) {
    throw new Error("derived_chart_limit_exceeded: analysis CSV exceeds 64 KiB.");
  }
  const parsed = await parseAttachment(bytes, "derived.csv", () => "derived_chart");
  const derivedTable = parsed.candidates[0];
  if (!derivedTable) {
    throw new Error("derived_chart_invalid: analysis CSV does not contain a table.");
  }
  if (derivedTable.rows.length > FILE_ARTIFACT_LIMITS.derivedChartRowsMax) {
    throw new Error("derived_chart_limit_exceeded: analysis CSV exceeds 50 rows.");
  }
  if (derivedTable.candidate.columns.length > FILE_ARTIFACT_LIMITS.derivedChartColumnsMax) {
    throw new Error("derived_chart_limit_exceeded: analysis CSV exceeds 20 columns.");
  }
  validateDerivedChartView(derivedTable.candidate.columns, view);
  return {
    provenance: {
      kind: "sandbox-derived" as const,
      sourceTable: sourceTable.table,
    },
    resultColumns: derivedTable.candidate.columns,
    resultCount: derivedTable.rows.length,
    rows: derivedTable.rows,
    truncated: false as const,
    view,
  };
}

function worksheetToMatrix(worksheet: ExcelJS.Worksheet): RawMatrix {
  const matrix: RawMatrix = [];
  for (let row = 1; row <= worksheet.rowCount; row += 1) {
    const values: RawCell[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      values.push(extractCellValue(worksheet.getCell(row, column).value));
    }
    matrix.push(values);
  }
  return matrix;
}

function extractCellValue(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (value instanceof Date || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "result" in value) {
    return extractCellValue(value.result as ExcelJS.CellValue);
  }
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

function discoverDenseBlocks(matrix: RawMatrix): Bounds[] {
  const used = usedBounds(matrix);
  if (!used) {
    return [];
  }
  const rowBands = splitIndexes(used.top, used.bottom, (row) => rowIsBlank(matrix, row, used.left, used.right));
  return rowBands.flatMap((rowBand) => {
    const columnBlocks = splitIndexes(used.left, used.right, (column) => columnIsBlank(matrix, column, rowBand.start, rowBand.end));
    return columnBlocks
      .map((columnBlock) => trimBounds(matrix, { bottom: rowBand.end, left: columnBlock.start, right: columnBlock.end, top: rowBand.start }))
      .filter((block): block is Bounds => block !== null);
  });
}

type Bounds = { bottom: number; left: number; right: number; top: number };

function usedBounds(matrix: RawMatrix): Bounds | null {
  let top = Number.POSITIVE_INFINITY;
  let bottom = 0;
  let left = Number.POSITIVE_INFINITY;
  let right = 0;
  matrix.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!isBlank(cell)) {
        top = Math.min(top, rowIndex + 1);
        bottom = Math.max(bottom, rowIndex + 1);
        left = Math.min(left, columnIndex + 1);
        right = Math.max(right, columnIndex + 1);
      }
    });
  });
  return bottom === 0 ? null : { bottom, left, right, top };
}

function splitIndexes(start: number, end: number, isBlankRange: (index: number) => boolean): Array<{ end: number; start: number }> {
  const ranges: Array<{ end: number; start: number }> = [];
  let activeStart: number | undefined;
  for (let index = start; index <= end; index += 1) {
    if (isBlankRange(index)) {
      if (activeStart !== undefined) {
        ranges.push({ end: index - 1, start: activeStart });
        activeStart = undefined;
      }
    } else if (activeStart === undefined) {
      activeStart = index;
    }
  }
  if (activeStart !== undefined) {
    ranges.push({ end, start: activeStart });
  }
  return ranges;
}

function rowIsBlank(matrix: RawMatrix, row: number, left: number, right: number): boolean {
  return Array.from({ length: right - left + 1 }, (_, offset) => matrix[row - 1]?.[left - 1 + offset] ?? null).every(isBlank);
}

function columnIsBlank(matrix: RawMatrix, column: number, top: number, bottom: number): boolean {
  return Array.from({ length: bottom - top + 1 }, (_, offset) => matrix[top - 1 + offset]?.[column - 1] ?? null).every(isBlank);
}

function trimBounds(matrix: RawMatrix, bounds: Bounds): Bounds | null {
  const used = usedBounds(
    Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, rowOffset) =>
      Array.from({ length: bounds.right - bounds.left + 1 }, (_, columnOffset) => matrix[bounds.top - 1 + rowOffset]?.[bounds.left - 1 + columnOffset] ?? null),
    ),
  );
  return used
    ? {
        bottom: used.bottom + bounds.top - 1,
        left: used.left + bounds.left - 1,
        right: used.right + bounds.left - 1,
        top: used.top + bounds.top - 1,
      }
    : null;
}

function buildTable({
  createTableId,
  matrix,
  rangeBounds,
  sheetName,
}: {
  createTableId: () => string;
  matrix: RawMatrix;
  rangeBounds: Bounds;
  sheetName: string;
}): ParsedTable | null {
  const rangeRows = readRange(matrix, rangeBounds);
  if (rangeRows.length === 0) {
    return null;
  }
  const hasTitle = nonBlankCount(rangeRows[0]!) === 1 && (rangeRows[1] ? textCount(rangeRows[1]) >= 2 : false);
  const headerOffset = hasTitle ? 1 : 0;
  const rawHeaders = rangeRows[headerOffset];
  if (!rawHeaders || rawHeaders.every(isBlank)) {
    return null;
  }
  const headers = normalizeHeaders(rawHeaders);
  const rawDataRows = rangeRows.slice(headerOffset + 1);
  const columns = headers.map((name, index) => ({ name, type: inferColumnType(rawDataRows.map((row) => row[index] ?? null)) } satisfies Column));
  const rows = rawDataRows
    .filter((row) => row.some((cell) => !isBlank(cell)))
    .map((row) => Object.fromEntries(columns.map((column, index) => [column.name, normalizeCell(row[index] ?? null, column.type)])));
  const table: TableRef = { tableId: createTableId(), sheetName, range: formatRange(rangeBounds) };
  return {
    candidate: {
      ...table,
      columns,
      headerRow: rangeBounds.top + headerOffset,
      profile: profileRows(rows, columns),
      rowCount: rows.length,
      sampleRows: rows.slice(0, FILE_ARTIFACT_LIMITS.sampleRowsMax),
      sourceHeaders: rawHeaders.map((value) => (value === null ? "" : String(value))),
    },
    rows,
    ...(hasTitle
      ? { warning: `${sheetName} ${formatRange(rangeBounds)}: the first row was treated as a title; header row is ${rangeBounds.top + headerOffset}.` }
      : {}),
  };
}

function readRange(matrix: RawMatrix, bounds: Bounds): RawMatrix {
  return Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, rowOffset) =>
    Array.from({ length: bounds.right - bounds.left + 1 }, (_, columnOffset) => matrix[bounds.top - 1 + rowOffset]?.[bounds.left - 1 + columnOffset] ?? null),
  );
}

function normalizeHeaders(rawHeaders: RawCell[]): string[] {
  const used = new Map<string, number>();
  return rawHeaders.map((header, index) => {
    const base = header === null || String(header).trim() === "" ? `column_${index + 1}` : String(header).trim();
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function inferColumnType(values: RawCell[]): Column["type"] {
  const nonBlank = values.filter((value): value is Exclude<RawCell, null> => !isBlank(value));
  if (nonBlank.length === 0) {
    return "string";
  }
  if (nonBlank.every((value) => typeof value === "number" || (typeof value === "string" && DECIMAL_LITERAL.test(value)))) {
    return "number";
  }
  if (nonBlank.every((value) => typeof value === "boolean" || (typeof value === "string" && /^(true|false)$/i.test(value)))) {
    return "boolean";
  }
  if (nonBlank.every((value) => value instanceof Date || (typeof value === "string" && ISO_DATE_LITERAL.test(value)))) {
    return "date";
  }
  return "string";
}

function normalizeCell(value: RawCell, type: Column["type"]): Scalar {
  if (isBlank(value)) {
    return null;
  }
  if (type === "number") {
    return typeof value === "number" ? value : Number(value);
  }
  if (type === "boolean") {
    return typeof value === "boolean" ? value : String(value).toLowerCase() === "true";
  }
  if (type === "date") {
    return value instanceof Date ? value.toISOString() : value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function profileRows(rows: Array<Record<string, Scalar>>, columns: Column[]): TableCandidate["profile"] {
  const nullCounts: Record<string, number> = {};
  const numericRanges: Record<string, { min: number; max: number }> = {};
  for (const column of columns) {
    const values = rows.map((row) => row[column.name]);
    nullCounts[column.name] = values.filter((value) => value === null).length;
    if (column.type === "number") {
      const numbers = values.filter((value): value is number => typeof value === "number");
      if (numbers.length > 0) {
        numericRanges[column.name] = { max: Math.max(...numbers), min: Math.min(...numbers) };
      }
    }
  }
  return { nullCounts, numericRanges };
}

function runQuery(table: StoredTableData, query: TableQuery | ExportQuery): QueryResult {
  const filteredRows = filterRows(table, query.filter);
  if (query.type === "rows") {
    const columns = query.columns ?? table.columns.map((column) => column.name);
    columns.forEach((column) => requireColumn(table, column));
    const limit = "limit" in query ? query.limit : Number.POSITIVE_INFINITY;
    return {
      ordering: "source-row",
      resultColumns: table.columns.filter((column) => columns.includes(column.name)),
      rows: filteredRows.slice(0, limit).map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))),
      sourceMatchedCount: filteredRows.length,
      truncated: filteredRows.length > limit,
    };
  }
  if (query.type === "group_by") {
    const groupColumn = requireColumn(table, query.groupBy);
    if (query.aggregate.op !== "count") {
      const aggregateColumn = requireColumn(table, query.aggregate.column);
      if (aggregateColumn.type !== "number") {
        throw new Error(`Column ${aggregateColumn.name} must be numeric for ${query.aggregate.op}.`);
      }
    }
    const groups = new Map<string, { count: number; key: Scalar; numericValues: number[] }>();
    for (const row of filteredRows) {
      const key = row[groupColumn.name] ?? null;
      const serialized = `${typeof key}:${JSON.stringify(key)}`;
      const group = groups.get(serialized) ?? { count: 0, key, numericValues: [] };
      group.count += 1;
      if (query.aggregate.op !== "count") {
        const value = row[query.aggregate.column];
        if (typeof value === "number") {
          group.numericValues.push(value);
        }
      }
      groups.set(serialized, group);
    }
    const allRows = [...groups.values()].map((group) => {
      const value = query.aggregate.op === "count"
        ? group.count
        : query.aggregate.op === "sum"
          ? group.numericValues.reduce((total, value) => total + value, 0)
          : group.numericValues.length === 0
            ? 0
            : group.numericValues.reduce((total, value) => total + value, 0) / group.numericValues.length;
      return { [groupColumn.name]: group.key, value };
    });
    const limit = "limit" in query ? query.limit : Number.POSITIVE_INFINITY;
    return {
      ordering: "first-occurrence",
      resultColumns: [groupColumn, { name: "value", type: "number" }],
      rows: allRows.slice(0, limit),
      sourceMatchedCount: filteredRows.length,
      truncated: allRows.length > limit,
    };
  }

  const column = requireColumn(table, query.column);
  if (column.type !== "number") {
    throw new Error(`Column ${column.name} must be numeric for a histogram.`);
  }
  const values = filteredRows.map((row) => row[column.name]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) {
    return { ordering: "ascending-bin", resultColumns: histogramColumns(), rows: [], sourceMatchedCount: filteredRows.length, truncated: false };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return {
      ordering: "ascending-bin",
      resultColumns: histogramColumns(),
      rows: [{ binStart: min, binEnd: max, count: values.length }],
      sourceMatchedCount: filteredRows.length,
      truncated: false,
    };
  }
  const width = (max - min) / query.bins;
  const bins = Array.from({ length: query.bins }, (_, index) => ({
    binEnd: index === query.bins - 1 ? max : min + width * (index + 1),
    binStart: min + width * index,
    count: 0,
  }));
  values.forEach((value) => {
    const index = Math.min(Math.floor((value - min) / width), bins.length - 1);
    bins[index]!.count += 1;
  });
  return { ordering: "ascending-bin", resultColumns: histogramColumns(), rows: bins, sourceMatchedCount: filteredRows.length, truncated: false };
}

function filterRows(table: StoredTableData, filter: { column: string; equals: Scalar } | undefined) {
  if (!filter) {
    return table.rows;
  }
  const column = requireColumn(table, filter.column);
  if (filter.equals !== null && typeof filter.equals !== column.type && !(column.type === "date" && typeof filter.equals === "string")) {
    throw new Error(`Filter value type does not match column ${column.name}.`);
  }
  return table.rows.filter((row) => Object.is(row[column.name], filter.equals));
}

function requireColumn(table: StoredTableData, name: string): Column {
  const column = table.columns.find((candidate) => candidate.name === name);
  if (!column) {
    throw new Error(`Unknown column: ${name}.`);
  }
  return column;
}

function validateView(table: StoredTableData, query: TableQuery, view: DataView | undefined, resultColumns: Column[]) {
  if (!view || view.type === "table") {
    return;
  }
  if (view.kind === "line") {
    const x = requireColumn(table, view.x);
    const y = requireColumn(table, view.y ?? "");
    if (query.type !== "rows" || x.type !== "date" || y.type !== "number" || !resultColumns.some((column) => column.name === x.name) || !resultColumns.some((column) => column.name === y.name)) {
      throw new Error("Line charts require a rows query containing a date x column and numeric y column.");
    }
    return;
  }
  if (view.kind === "bar") {
    if (query.type !== "group_by" || view.x !== query.groupBy || view.y !== "value") {
      throw new Error("Bar charts require a matching group_by query with y = value.");
    }
    return;
  }
  if (query.type !== "histogram" || view.x !== query.column || view.y !== undefined) {
    throw new Error("Histogram charts require a matching histogram query without y.");
  }
}

function validateDerivedChartView(columns: Column[], view: DerivedChartView) {
  const x = columns.find((column) => column.name === view.x);
  const y = columns.find((column) => column.name === view.y);
  if (!x) {
    throw new Error(`derived_chart_invalid: unknown x column ${view.x}.`);
  }
  if (!y) {
    throw new Error(`derived_chart_invalid: unknown y column ${view.y}.`);
  }
  if (x.type !== "string" && x.type !== "date") {
    throw new Error("derived_chart_invalid: chart x column must be string or date.");
  }
  if (y.type !== "number") {
    throw new Error("derived_chart_invalid: chart y column must be numeric.");
  }
}

function histogramColumns(): Column[] {
  return [
    { name: "binStart", type: "number" },
    { name: "binEnd", type: "number" },
    { name: "count", type: "number" },
  ];
}

function toCsv(rows: Array<Record<string, Scalar>>, columns: Column[]): string {
  const names = columns.map((column) => column.name);
  const lines = [names.map((name) => quoteCsv(safeSpreadsheetValue(name))).join(",")];
  rows.forEach((row) => lines.push(names.map((name) => quoteCsv(safeSpreadsheetValue(row[name] ?? null))).join(",")));
  return `${lines.join("\n")}\n`;
}

function safeSpreadsheetValue(value: Scalar): string | number | boolean {
  if (typeof value !== "string") {
    return value ?? "";
  }
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function quoteCsv(value: Scalar | string | number | boolean): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeFilename(requestedFilename: string | undefined, extension: string): string {
  const base = (requestedFilename?.trim() || `table-export.${extension}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

function formatRange(bounds: Bounds): string {
  return `${columnLabel(bounds.left)}${bounds.top}:${columnLabel(bounds.right)}${bounds.bottom}`;
}

function columnLabel(column: number): string {
  let label = "";
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function isBlank(value: RawCell): value is null {
  return value === null || value === "";
}

function nonBlankCount(values: RawCell[]): number {
  return values.filter((value) => !isBlank(value)).length;
}

function textCount(values: RawCell[]): number {
  return values.filter((value) => typeof value === "string" && value.trim() !== "").length;
}
