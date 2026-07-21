import { defineTool } from "eve/tools";
import { downloadTableInputSchema, downloadTableOutputSchema } from "../../lib/file-artifacts/contracts";
import { exportStoredTable } from "../../lib/file-artifacts/core";
import { fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description: "Create a CSV or JSON download only when the user explicitly requests a downloadable file.",
  inputSchema: downloadTableInputSchema,
  outputSchema: downloadTableOutputSchema,
  async execute({ tableId, query, format, filename }) {
    const table = fileArtifactsState.get().tables[tableId];
    if (!table) {
      throw new Error("Unknown tableId. Inspect an attachment before creating a download.");
    }
    const artifact = exportStoredTable(table, query, format, filename);
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
      value: `Created user download ${output.filename} with ${output.rowCount} rows from ${output.table.sheetName} ${output.table.range}.`,
    };
  },
});
