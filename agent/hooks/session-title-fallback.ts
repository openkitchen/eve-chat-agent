import { defineHook } from "eve/hooks";
import { ensureFallbackSessionTitle } from "../../lib/session-titles";

export default defineHook({
  events: {
    async "message.received"(_event, ctx) {
      try {
        await ensureFallbackSessionTitle(ctx.session.id);
      } catch (error) {
        console.warn("Unable to write the session title fallback.", { error, sessionId: ctx.session.id });
      }
    },
  },
});
