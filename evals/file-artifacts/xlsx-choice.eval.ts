import { defineEval } from "eve/evals";

export default defineEval({
  description: "Pauses for a user choice when one XLSX sheet contains two table candidates.",
  tags: ["file-artifacts", "live"],
  timeoutMs: 90_000,
  async test(t) {
    const first = await t.sendFile(
      "Ask me which table to use, then show the selected table's rows as a table.",
      "test/fixtures/file-artifacts/report.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    first.parked();
    first.calledTool("list_attachments");
    first.calledTool("inspect_attachment");
    first.notCalledTool("query_table");
    const request = t.requireInputRequest({ toolName: "ask_question" });
    const optionId = request.options?.[0]?.id;
    if (!optionId) {
      throw new Error("Expected a selectable table candidate.");
    }
    await t.respondAll(optionId);
    t.succeeded();
    t.calledTool("query_table", { input: { tableId: optionId } });
  },
});
