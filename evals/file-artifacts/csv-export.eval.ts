import { defineEval } from "eve/evals";

export default defineEval({
  description: "Exports filtered CSV data without exposing its data URL to the model.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    await t.sendFile(
      "Export all orders with status open as a CSV download. Use the file analysis tools.",
      "test/fixtures/file-artifacts/orders.csv",
      "text/csv",
    );
    t.succeeded();
    t.toolOrder(["glob", "inspect_attachment", "export_table"]);
    t.notCalledTool("ask_question");
    t.calledTool("export_table", {
      input: {
        format: "csv",
        query: { filter: { column: "status", equals: "open" }, type: "rows" },
      },
      output: { rowCount: 2 },
    });
  },
});
