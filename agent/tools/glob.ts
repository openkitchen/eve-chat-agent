import { createHash } from "node:crypto";
import { defineTool } from "eve/tools";
import { scopedGlobInputSchema, scopedGlobOutputSchema } from "../../lib/file-artifacts/contracts";
import { fileArtifactsState } from "../lib/file-artifacts-state";

const MAX_ATTACHMENTS = 20;

export default defineTool({
  description: "List supported CSV and XLSX attachments for the current session. Call this before inspecting an attachment.",
  inputSchema: scopedGlobInputSchema,
  outputSchema: scopedGlobOutputSchema,
  async execute(_input, ctx) {
    const sandbox = await ctx.getSandbox();
    const result = await sandbox.run({ command: "ls -1 /workspace/attachments/*/*" });
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      throw new Error("Unable to enumerate staged attachments.");
    }
    const paths = result.stdout
      .split("\n")
      .filter((path) => path.startsWith("/workspace/attachments/"))
      .filter((path) => /\.(csv|xlsx)$/i.test(path))
      .sort();
    const attachments = await Promise.all(
      paths.slice(0, MAX_ATTACHMENTS).map(async (path) => {
        const filename = path.split("/").at(-1) ?? "attachment";
        const bytes = await sandbox.readBinaryFile({ path });
        if (!bytes) {
          throw new Error(`Attachment disappeared before it could be listed: ${filename}.`);
        }
        const format = filename.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
        const attachmentId = `attachment_${createHash("sha256")
          .update(`${sandbox.id}:${path}`)
          .digest("hex")
          .slice(0, 16)}`;
        return { attachmentId, filename, format, path, size: bytes.byteLength } as const;
      }),
    );
    fileArtifactsState.update((state) => ({
      ...state,
      attachments: Object.fromEntries(attachments.map(({ path, ...attachment }) => [attachment.attachmentId, { ...attachment, path }])),
    }));
    return {
      attachments: attachments.map(({ path: _path, ...attachment }) => attachment),
      truncated: paths.length > MAX_ATTACHMENTS,
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
