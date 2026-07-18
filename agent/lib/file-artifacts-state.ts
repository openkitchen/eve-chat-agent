import { defineState } from "eve/context";
import { FILE_ARTIFACT_LIMITS, type AttachmentRef, type Column, type Scalar, type TableRef } from "../../lib/file-artifacts/contracts";

export type StoredAttachment = AttachmentRef & {
  path: string;
};

export type StoredTable = {
  columns: Column[];
  rows: Array<Record<string, Scalar>>;
  table: TableRef;
};

export type FileArtifactsState = {
  attachments: Record<string, StoredAttachment>;
  tables: Record<string, StoredTable>;
};

export const fileArtifactsState = defineState<FileArtifactsState>("file-artifacts", () => ({
  attachments: {},
  tables: {},
}));

export function assertFileArtifactsCapacity(state: FileArtifactsState, addedTables: StoredTable[]) {
  const tables = [...Object.values(state.tables), ...addedTables];
  const rowCount = tables.reduce((total, table) => total + table.rows.length, 0);
  const cellCount = tables.reduce((total, table) => total + table.rows.length * table.columns.length, 0);
  const serializedBytes = new TextEncoder().encode(JSON.stringify(tables)).byteLength;
  if (tables.length > FILE_ARTIFACT_LIMITS.sessionTablesMax) {
    throw new Error(`Session exceeds the ${FILE_ARTIFACT_LIMITS.sessionTablesMax}-table POC limit.`);
  }
  if (rowCount > FILE_ARTIFACT_LIMITS.sessionRowsMax) {
    throw new Error(`Session exceeds the ${FILE_ARTIFACT_LIMITS.sessionRowsMax}-row POC limit.`);
  }
  if (cellCount > FILE_ARTIFACT_LIMITS.sessionCellsMax) {
    throw new Error(`Session exceeds the ${FILE_ARTIFACT_LIMITS.sessionCellsMax}-cell POC limit.`);
  }
  if (serializedBytes > FILE_ARTIFACT_LIMITS.sessionBytesMax) {
    throw new Error(`Session exceeds the ${FILE_ARTIFACT_LIMITS.sessionBytesMax}-serialized-byte POC limit.`);
  }
}
