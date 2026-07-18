import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

export default defineEval({
  description: "Continues a completed conversation in the same durable session.",
  tags: ["smoke", "multiturn"],
  async test(t) {
    const first = await t.send("Reply with a short greeting.");
    const second = await t.send("Reply with a different short greeting.");

    await t.require(second.sessionId, equals(first.sessionId));
    t.succeeded();
  },
});
