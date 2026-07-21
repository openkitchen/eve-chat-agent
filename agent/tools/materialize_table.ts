import { defineTool } from "eve/tools";
import { materializeTableInputSchema, materializeTableOutputSchema } from "../../lib/file-artifacts/contracts";
import { materializeStoredTableCsv } from "../../lib/file-artifacts/core";
import { fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description: "Write an inspected table to a sandbox CSV for the current agent's Python or shell analysis. Never use this for a user download.",
  inputSchema: materializeTableInputSchema,
  outputSchema: materializeTableOutputSchema,
  async execute({ tableId }, ctx) {
    const table = fileArtifactsState.get().tables[tableId];
    if (!table) {
      throw new Error("Unknown tableId. Inspect an attachment before materializing it.");
    }
    const artifact = materializeStoredTableCsv(table);
    const sandbox = await ctx.getSandbox();
    const path = `/workspace/analysis/input/${tableId}.csv`;
    const directory = await sandbox.run({ command: "mkdir -p /workspace/analysis/input" });
    if (directory.exitCode !== 0) {
      throw new Error("Unable to prepare the sandbox analysis input directory.");
    }
    await sandbox.writeBinaryFile({ content: artifact.bytes, path });
    return { format: "csv" as const, path, schema: artifact.columns };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
