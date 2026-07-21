import { defineEval } from "eve/evals";

export default defineEval({
  description: "Creates a filtered CSV download only for an explicit user download request.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    await t.sendFile(
      "Export all orders with status open as a CSV download. Use the file analysis tools.",
      "test/fixtures/file-artifacts/orders.csv",
      "text/csv",
    );
    t.succeeded();
    t.toolOrder(["list_attachments", "inspect_attachment", "download_table"]);
    t.notCalledTool("ask_question");
    t.calledTool("download_table", {
      input: {
        format: "csv",
        query: { filter: { column: "status", equals: "open" }, type: "rows" },
      },
      output: { rowCount: 2 },
    });
  },
});
