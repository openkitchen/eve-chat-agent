import { defineEval } from "eve/evals";

export default defineEval({
  description: "Lets the agent choose a suitable chart for an order-amount change analysis.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    await t.sendFile(
      "Analyze how order amount changes over time in this CSV. Choose the most suitable visualization and use the file analysis tools.",
      "test/fixtures/file-artifacts/orders.csv",
      "text/csv",
    );
    t.succeeded();
    t.toolOrder(["glob", "inspect_attachment", "query_table"]);
    t.calledTool("glob");
    t.calledTool("inspect_attachment");
    t.notCalledTool("ask_question");
    t.calledTool("query_table", {
      input: {
        query: { type: "rows" },
        view: { kind: "line" },
      },
    });
  },
});
