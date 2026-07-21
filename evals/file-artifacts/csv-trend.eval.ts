import { defineEval } from "eve/evals";

export default defineEval({
  description: "Builds one multi-series line chart from a chart-ready sandbox CSV.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    await t.sendFile(
      "Draw one line chart that compares APAC, EMEA, and LATAM revenue by month. Keep all three regions in the same chart and use the file analysis tools.",
      "test/fixtures/file-artifacts/regional-revenue.csv",
      "text/csv",
    );
    t.succeeded();
    t.toolOrder(["list_attachments", "inspect_attachment", "materialize_table", "draw_chart"]);
    t.calledTool("list_attachments");
    t.calledTool("inspect_attachment");
    t.notCalledTool("ask_question");
    t.calledTool("materialize_table");
    t.calledTool("draw_chart");
  },
});
