"use client";

import type { z } from "zod";
import { TableIcon } from "lucide-react";
import { type queryTableOutputSchema } from "@/lib/file-artifacts/contracts";

type QueryOutput = z.infer<typeof queryTableOutputSchema>;

export function DataTableCard({ output }: { readonly output: QueryOutput }) {
  return (
    <section className="space-y-3">
      <CardHeading icon={<TableIcon className="size-4" />} output={output} />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {output.resultColumns.map((column) => (
                <th className="whitespace-nowrap px-3 py-2 font-medium" key={column.name} scope="col">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.rows.map((row, rowIndex) => (
              <tr className="border-t" key={rowIndex}>
                {output.resultColumns.map((column) => (
                  <td className="whitespace-nowrap px-3 py-2" key={column.name}>
                    {formatValue(row[column.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {output.rows.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">No matching data.</p> : null}
      </div>
      <CardFooter output={output} />
    </section>
  );
}

export function CardHeading({
  icon,
  output,
}: {
  readonly icon: React.ReactNode;
  readonly output: QueryOutput;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{output.view?.title ?? "Data view"}</span>
      <span className="text-muted-foreground">{output.table.sheetName} {output.table.range}</span>
    </div>
  );
}

export function CardFooter({ output }: { readonly output: QueryOutput }) {
  return (
    <p className="text-muted-foreground text-xs">
      {output.resultCount} shown from {output.sourceMatchedCount} matched source rows{output.truncated ? "; result truncated" : ""}.
    </p>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
}
