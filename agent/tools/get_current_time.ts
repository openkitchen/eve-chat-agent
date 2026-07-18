import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current date and time for an IANA time zone.",
  inputSchema: z.object({
    timeZone: z.string().min(1).max(100).default("UTC"),
  }),
  async execute({ timeZone }) {
    const now = new Date();

    try {
      return {
        iso8601: now.toISOString(),
        timeZone,
        formatted: new Intl.DateTimeFormat("en-CA", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone,
        }).format(now),
      };
    } catch {
      return {
        error: `Invalid IANA time zone: ${timeZone}`,
      };
    }
  },
});
