import { defineTool } from "eve/tools";
import { drawChartInputSchema, drawChartOutputSchema } from "../../lib/file-artifacts/contracts";
import { drawChart } from "../../lib/file-artifacts/core";

export default defineTool({
  description: "Render a supported Recharts Cartesian line or bar chart from a validated CSV under /workspace/analysis. Pie, donut, area, scatter, radar, and mixed charts are not supported. The CSV must already have the columns needed by the renderer; use Python only to prepare data for a supported chart.",
  inputSchema: drawChartInputSchema,
  outputSchema: drawChartOutputSchema,
  async execute({ source, spec }, ctx) {
    const sandbox = await ctx.getSandbox();
    const bytes = await sandbox.readBinaryFile({ path: source.path });
    if (!bytes) {
      throw new Error("Chart source CSV is not available in the sandbox.");
    }
    return drawChart(bytes, spec, source.path.includes("/input/") ? "materialized-table" : "sandbox-derived");
  },
  toModelOutput(output) {
    return {
      type: "text",
      value: `Rendered a ${output.spec.chart.type} chart with ${output.provenance.rowCount} rows and ${output.spec.series.length} series.`,
    };
  },
});
