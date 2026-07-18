import { defineTool } from "eve/tools";
import { exportTableInputSchema, exportTableOutputSchema } from "../../lib/file-artifacts/contracts";
import { exportStoredTable } from "../../lib/file-artifacts/core";
import { fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description: "Export every row or group matching a deterministic query as a bounded CSV or JSON download.",
  inputSchema: exportTableInputSchema,
  outputSchema: exportTableOutputSchema,
  async execute({ tableId, query, format, filename }, ctx) {
    const table = fileArtifactsState.get().tables[tableId];
    if (!table) {
      throw new Error("Unknown tableId. Inspect an attachment before exporting it.");
    }
    const artifact = exportStoredTable(table, query, format, filename);
    const sandbox = await ctx.getSandbox();
    await sandbox.writeBinaryFile({
      content: artifact.bytes,
      path: `/workspace/derived/artifacts/${artifact.filename}`,
    });
    const mediaType: "application/json" | "text/csv" = artifact.mediaType;
    return {
      dataUrl: `data:${mediaType};base64,${Buffer.from(artifact.bytes).toString("base64")}`,
      filename: artifact.filename,
      mediaType,
      rowCount: artifact.rowCount,
      table: table.table,
    };
  },
  toModelOutput(output) {
    return {
      type: "text",
      value: `Created ${output.filename} with ${output.rowCount} rows from ${output.table.sheetName} ${output.table.range}.`,
    };
  },
});
