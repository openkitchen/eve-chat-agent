"use client";

import { DownloadIcon, FileDownIcon } from "lucide-react";
import type { z } from "zod";
import { type exportTableOutputSchema } from "@/lib/file-artifacts/contracts";
import { Button } from "@/components/ui/button";

type ExportOutput = z.infer<typeof exportTableOutputSchema>;

export function DownloadFileCard({ output }: { readonly output: ExportOutput }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileDownIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{output.filename}</p>
          <p className="text-muted-foreground">{output.rowCount} rows from {output.table.sheetName} {output.table.range}</p>
        </div>
      </div>
      <Button asChild size="icon-sm" title={`Download ${output.filename}`} variant="outline">
        <a download={output.filename} href={output.dataUrl}>
          <DownloadIcon className="size-4" />
          <span className="sr-only">Download {output.filename}</span>
        </a>
      </Button>
    </section>
  );
}
