import { defineTool } from "eve/tools";
import {
  publishDerivedChartInputSchema,
  publishDerivedChartOutputSchema,
} from "../../lib/file-artifacts/contracts";
import { publishDerivedChart } from "../../lib/file-artifacts/core";
import { fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description:
    "Publish a validated line or bar chart from a CSV the current agent created under /workspace/analysis. Use only after generating and checking that CSV with sandbox tools.",
  inputSchema: publishDerivedChartInputSchema,
  outputSchema: publishDerivedChartOutputSchema,
  async execute({ analysisFile, sourceTableId, view }, ctx) {
    const sourceTable = fileArtifactsState.get().tables[sourceTableId];
    if (!sourceTable) {
      throw new Error("Unknown sourceTableId. Inspect an attachment before publishing a derived chart.");
    }
    const sandbox = await ctx.getSandbox();
    const bytes = await sandbox.readBinaryFile({ path: `/workspace/analysis/${analysisFile}` });
    if (!bytes) {
      throw new Error("Derived analysis CSV is not available in the sandbox.");
    }
    return publishDerivedChart(bytes, sourceTable, view);
  },
  toModelOutput(output) {
    return {
      type: "text",
      value: `Published a ${output.view.kind} chart with ${output.resultCount} derived rows from ${output.provenance.sourceTable.sheetName} ${output.provenance.sourceTable.range}.`,
    };
  },
});
