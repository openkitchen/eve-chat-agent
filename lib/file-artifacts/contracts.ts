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
});

export const exportQuerySchema = z.discriminatedUnion("type", [
  rowsQuerySchema.omit({ limit: true }),
  groupByQuerySchema.omit({ limit: true }),
]);
export const downloadTableInputSchema = z.object({
  tableId: z.string().min(1),
  query: exportQuerySchema,
  format: z.enum(["csv", "json"]),
  filename: z.string().max(100).optional(),
});
export const downloadTableOutputSchema = z.object({
  table: tableRefSchema,
  filename: z.string().min(1),
  mediaType: z.enum(["text/csv", "application/json"]),
  rowCount: z.number().int().nonnegative(),
  dataUrl: z.string().startsWith("data:"),
});

const safeAnalysisCsvPathSchema = z
  .string()
  .min("/workspace/analysis/".length + 5)
  .max(240)
  .regex(/^\/workspace\/analysis\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.csv$/, "path must be a safe CSV path under /workspace/analysis/.")
  .refine((path) => !path.includes(".."), "path must not contain traversal segments.");

export const dataRefSchema = z.object({
  path: safeAnalysisCsvPathSchema,
  format: z.literal("csv"),
  schema: z.array(columnSchema).min(1).max(FILE_ARTIFACT_LIMITS.sourceColumnsMax),
});

export const materializeTableInputSchema = z.object({ tableId: z.string().min(1) });
export const materializeTableOutputSchema = dataRefSchema;

const axisSchema = z.object({
  dataKey: z.string().min(1),
  type: z.enum(["category", "number"]).optional(),
  label: z.string().max(120).optional(),
  interval: z.enum(["auto", "preserveStartEnd"]).optional(),
});

const yAxisSchema = z.object({
  id: z.enum(["left", "right"]),
  label: z.string().max(120).optional(),
  scale: z.enum(["linear", "log"]).optional(),
  domain: z.union([z.literal("auto"), z.literal("zeroToDataMax"), z.tuple([z.number(), z.number()])]).optional(),
});

const chartSeriesSchema = z.object({
  type: z.enum(["line", "bar"]),
  dataKey: z.string().min(1),
  name: z.string().max(120).optional(),
  yAxisId: z.enum(["left", "right"]).optional(),
  stackId: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be a hex color.").optional(),
  strokeWidth: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dot: z.boolean().optional(),
});

export const rechartsCartesianSpecSchema = z.object({
  renderer: z.literal("recharts-cartesian-v1"),
  title: z.string().min(1).max(120).optional(),
  chart: z.object({
    type: z.enum(["line", "bar"]),
    margin: z.object({ top: z.number().int().min(0).max(64).optional(), right: z.number().int().min(0).max(64).optional(), bottom: z.number().int().min(0).max(64).optional(), left: z.number().int().min(0).max(64).optional() }).optional(),
  }),
  xAxis: axisSchema,
  yAxes: z.array(yAxisSchema).min(1).max(2).optional(),
  series: z.array(chartSeriesSchema).min(1).max(12),
  grid: z.object({ show: z.boolean() }).optional(),
  legend: z.object({ show: z.boolean(), verticalAlign: z.enum(["top", "bottom"]).optional() }).optional(),
  tooltip: z.object({ show: z.boolean(), shared: z.boolean().optional() }).optional(),
});

export const drawChartInputSchema = z.object({
  source: dataRefSchema,
  spec: rechartsCartesianSpecSchema,
});

export const drawChartOutputSchema = z.object({
  data: z.array(rowSchema).max(FILE_ARTIFACT_LIMITS.derivedChartRowsMax),
  spec: rechartsCartesianSpecSchema,
  provenance: z.object({
    kind: z.enum(["sandbox-derived", "materialized-table"]),
    rowCount: z.number().int().nonnegative().max(FILE_ARTIFACT_LIMITS.derivedChartRowsMax),
  }),
});

export type AttachmentRef = z.infer<typeof attachmentRefSchema>;
export type Column = z.infer<typeof columnSchema>;
export type DataRef = z.infer<typeof dataRefSchema>;
export type DownloadTableInput = z.infer<typeof downloadTableInputSchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type RechartsCartesianSpec = z.infer<typeof rechartsCartesianSpecSchema>;
export type QueryTableInput = z.infer<typeof queryTableInputSchema>;
export type Scalar = z.infer<typeof scalarSchema>;
export type TableCandidate = z.infer<typeof tableCandidateSchema>;
export type TableQuery = z.infer<typeof tableQuerySchema>;
export type TableRef = z.infer<typeof tableRefSchema>;
