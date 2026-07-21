import { defineTool } from "eve/tools";
import { queryTableInputSchema, queryTableOutputSchema } from "../../lib/file-artifacts/contracts";
import { queryStoredTable } from "../../lib/file-artifacts/core";
import { fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description: "Run a bounded deterministic rows, group_by, or histogram query against an inspected table.",
  inputSchema: queryTableInputSchema,
  outputSchema: queryTableOutputSchema,
  async execute({ tableId, query }) {
    const table = fileArtifactsState.get().tables[tableId];
    if (!table) {
      throw new Error("Unknown tableId. Inspect an attachment before querying it.");
    }
    return queryStoredTable(table, query);
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
