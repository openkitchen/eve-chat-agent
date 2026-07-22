import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Declines chart types outside the line and bar renderer contract without attempting sandbox analysis.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    await t.send("Please make a pie chart of revenue by region.");
    t.succeeded();
    t.notCalledTool("materialize_table");
    t.notCalledTool("draw_chart");
    t.notCalledTool("bash");
    if (!t.reply) {
      throw new Error("Expected an explanation of the unsupported chart type.");
    }
    t.check(t.reply.toLowerCase(), includes("line"));
    t.check(t.reply.toLowerCase(), includes("bar"));
  },
});
