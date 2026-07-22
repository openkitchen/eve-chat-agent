import { defineTool } from "eve/tools";
import { z } from "zod";
import { writeSessionTitle } from "../../lib/session-titles";

const inputSchema = z.object({
  title: z.string().min(1).max(80),
});

const outputSchema = z.object({
  title: z.string().min(1).max(80),
  written: z.boolean(),
});

export default defineTool({
  description: "Set the short, user-facing title for a new chat. It replaces the server-provided generic fallback exactly once; later calls preserve the existing semantic title.",
  inputSchema,
  outputSchema,
  async execute({ title }, ctx) {
    return writeSessionTitle(ctx.session.id, title);
  },
  toModelOutput(output) {
    return { type: "text", value: output.written ? `Set this chat title to: ${output.title}` : `This chat title is already: ${output.title}` };
  },
});
