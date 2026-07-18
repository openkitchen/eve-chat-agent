import { z } from "zod";

export const FILE_ARTIFACT_LIMITS = {
  chartBinsMax: 20,
  chartBinsMin: 5,
  derivedChartBytesMax: 64 * 1024,
  derivedChartColumnsMax: 20,
  derivedChartRowsMax: 50,
  exportBytesMax: 1024 * 1024,
  exportRowsMax: 500,
  fileBytesMax: 10 * 1024 * 1024,
  queryGroupsMax: 20,
  queryRowsMax: 50,
  sampleRowsMax: 5,
  sessionCellsMax: 200_000,
  sessionBytesMax: 2 * 1024 * 1024,
  sessionRowsMax: 10_000,
  sessionTablesMax: 20,
  sourceCellsMax: 200_000,
  sourceColumnsMax: 100,
  sourceRowsMax: 10_000,
} as const;

export const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const rowSchema = z.record(z.string(), scalarSchema);

export const columnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean", "mixed"]),
});

export const tableRefSchema = z.object({
  tableId: z.string().min(1),
  sheetName: z.string().min(1),
  range: z.string().min(1),
});

export const equalsFilterSchema = z.object({
  column: z.string().min(1),
  equals: scalarSchema,
});

export const aggregateSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("count") }),
  z.object({ op: z.literal("sum"), column: z.string().min(1) }),
  z.object({ op: z.literal("avg"), column: z.string().min(1) }),
]);

export const rowsQuerySchema = z.object({
  type: z.literal("rows"),
  columns: z.array(z.string().min(1)).min(1).optional(),
  filter: equalsFilterSchema.optional(),
  limit: z.number().int().min(1).max(FILE_ARTIFACT_LIMITS.queryRowsMax).default(20),
});

export const groupByQuerySchema = z.object({
  type: z.literal("group_by"),
  groupBy: z.string().min(1),
  aggregate: aggregateSchema,
  filter: equalsFilterSchema.optional(),
  limit: z.number().int().min(1).max(FILE_ARTIFACT_LIMITS.queryGroupsMax).default(12),
});

export const histogramQuerySchema = z.object({
  type: z.literal("histogram"),
  column: z.string().min(1),
  bins: z.number().int().min(FILE_ARTIFACT_LIMITS.chartBinsMin).max(FILE_ARTIFACT_LIMITS.chartBinsMax).default(10),
  filter: equalsFilterSchema.optional(),
});

export const tableQuerySchema = z.discriminatedUnion("type", [
  rowsQuerySchema,
  groupByQuerySchema,
  histogramQuerySchema,
]);

export const dataViewSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("table"), title: z.string().max(120).optional() }),
  z.object({
    type: z.literal("chart"),
    kind: z.enum(["line", "bar", "histogram"]),
    title: z.string().max(120).optional(),
    x: z.string().min(1),
    y: z.string().min(1).optional(),
  }),
]);

export const attachmentRefSchema = z.object({
  attachmentId: z.string().min(1),
  filename: z.string().min(1),
  format: z.enum(["csv", "xlsx"]),
  size: z.number().int().nonnegative(),
});

export const scopedGlobInputSchema = z.object({});
export const scopedGlobOutputSchema = z.object({
  attachments: z.array(attachmentRefSchema).max(20),
  truncated: z.boolean(),
});

export const inspectAttachmentInputSchema = z.object({ attachmentId: z.string().min(1) });
export const tableCandidateSchema = tableRefSchema.extend({
  headerRow: z.number().int().positive(),
  sourceHeaders: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(columnSchema),
  sampleRows: z.array(rowSchema).max(FILE_ARTIFACT_LIMITS.sampleRowsMax),
  profile: z.object({
    nullCounts: z.record(z.string(), z.number().int().nonnegative()),
    numericRanges: z.record(z.string(), z.object({ min: z.number(), max: z.number() })),
  }),
});
export const inspectAttachmentOutputSchema = z.object({
  filename: z.string().min(1),
  format: z.enum(["csv", "xlsx"]),
  candidates: z.array(tableCandidateSchema).max(20),
  warnings: z.array(z.string()),
});

export const queryTableInputSchema = z.object({
  tableId: z.string().min(1),
  query: tableQuerySchema,
  view: dataViewSchema.optional(),
});
export const queryTableOutputSchema = z.object({
  table: tableRefSchema,
  query: tableQuerySchema,
  resultColumns: z.array(columnSchema),
  rows: z.array(rowSchema),
  sourceMatchedCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  ordering: z.enum(["source-row", "first-occurrence", "ascending-bin"]),
  view: dataViewSchema.optional(),
});

export const exportQuerySchema = z.discriminatedUnion("type", [
  rowsQuerySchema.omit({ limit: true }),
  groupByQuerySchema.omit({ limit: true }),
]);
export const exportTableInputSchema = z.object({
  tableId: z.string().min(1),
  query: exportQuerySchema,
  format: z.enum(["csv", "json"]),
  filename: z.string().max(100).optional(),
});
export const exportTableOutputSchema = z.object({
  table: tableRefSchema,
  filename: z.string().min(1),
  mediaType: z.enum(["text/csv", "application/json"]),
  rowCount: z.number().int().nonnegative(),
  dataUrl: z.string().startsWith("data:"),
});

const safeAnalysisFilenameSchema = z
  .string()
  .min(5)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.csv$/, "analysisFile must be a safe CSV basename.")
  .refine((filename) => !filename.includes(".."), "analysisFile must not contain traversal segments.");

export const derivedChartViewSchema = z.object({
  type: z.literal("chart"),
  kind: z.enum(["line", "bar"]),
  title: z.string().max(120).optional(),
  x: z.string().min(1),
  y: z.string().min(1),
});

export const publishDerivedChartInputSchema = z.object({
  analysisFile: safeAnalysisFilenameSchema,
  sourceTableId: z.string().min(1),
  view: derivedChartViewSchema,
});

export const publishDerivedChartOutputSchema = z.object({
  provenance: z.object({
    kind: z.literal("sandbox-derived"),
    sourceTable: tableRefSchema,
  }),
  resultColumns: z.array(columnSchema).min(2).max(FILE_ARTIFACT_LIMITS.derivedChartColumnsMax),
  rows: z.array(rowSchema).max(FILE_ARTIFACT_LIMITS.derivedChartRowsMax),
  resultCount: z.number().int().nonnegative().max(FILE_ARTIFACT_LIMITS.derivedChartRowsMax),
  truncated: z.literal(false),
  view: derivedChartViewSchema,
});

export type AttachmentRef = z.infer<typeof attachmentRefSchema>;
export type Column = z.infer<typeof columnSchema>;
export type DataView = z.infer<typeof dataViewSchema>;
export type DerivedChartView = z.infer<typeof derivedChartViewSchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type PublishDerivedChartInput = z.infer<typeof publishDerivedChartInputSchema>;
export type QueryTableInput = z.infer<typeof queryTableInputSchema>;
export type Scalar = z.infer<typeof scalarSchema>;
export type TableCandidate = z.infer<typeof tableCandidateSchema>;
export type TableQuery = z.infer<typeof tableQuerySchema>;
export type TableRef = z.infer<typeof tableRefSchema>;
