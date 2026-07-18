import { randomUUID } from "node:crypto";
import { defineTool } from "eve/tools";
import { FILE_ARTIFACT_LIMITS, inspectAttachmentInputSchema, inspectAttachmentOutputSchema } from "../../lib/file-artifacts/contracts";
import { parseAttachment } from "../../lib/file-artifacts/core";
import { assertFileArtifactsCapacity, fileArtifactsState } from "../lib/file-artifacts-state";

export default defineTool({
  description: "Inspect one CSV or XLSX attachment discovered by glob. Returns deterministic table candidates, schemas, samples, and profiles.",
  inputSchema: inspectAttachmentInputSchema,
  outputSchema: inspectAttachmentOutputSchema,
  async execute({ attachmentId }, ctx) {
    const attachment = fileArtifactsState.get().attachments[attachmentId];
    if (!attachment) {
      throw new Error("Unknown attachmentId. Call glob and use one returned by this session.");
    }
    if (attachment.size > FILE_ARTIFACT_LIMITS.fileBytesMax) {
      throw new Error("Attachment exceeds the 10 MiB POC limit.");
    }
    const sandbox = await ctx.getSandbox();
    const bytes = await sandbox.readBinaryFile({ path: attachment.path });
    if (!bytes) {
      throw new Error("Attachment is no longer available in the sandbox.");
    }
    const parsed = await parseAttachment(bytes, attachment.filename, () => `table_${randomUUID()}`);
    const parsedTables = parsed.candidates.map(({ candidate, rows }) => ({
      columns: candidate.columns,
      rows,
      table: {
        range: candidate.range,
        sheetName: candidate.sheetName,
        tableId: candidate.tableId,
      },
    }));
    assertFileArtifactsCapacity(fileArtifactsState.get(), parsedTables);
    fileArtifactsState.update((state) => ({
      ...state,
      tables: {
        ...state.tables,
        ...Object.fromEntries(parsedTables.map((table) => [table.table.tableId, table])),
      },
    }));
    return {
      candidates: parsed.candidates.map(({ candidate }) => candidate),
      filename: attachment.filename,
      format: parsed.format,
      warnings: parsed.warnings,
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
