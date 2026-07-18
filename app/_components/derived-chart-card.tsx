"use client";

import { BarChart3Icon } from "lucide-react";
import type { z } from "zod";
import { type publishDerivedChartOutputSchema } from "@/lib/file-artifacts/contracts";
import { ChartPlot } from "./chart-card";

type DerivedChartOutput = z.infer<typeof publishDerivedChartOutputSchema>;

export function DerivedChartCard({ output }: { readonly output: DerivedChartOutput }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <BarChart3Icon className="size-4 text-muted-foreground" />
        <span className="font-medium">{output.view.title ?? "Derived data view"}</span>
        <span className="text-muted-foreground">
          {output.provenance.sourceTable.sheetName} {output.provenance.sourceTable.range}
        </span>
      </div>
      {output.rows.length === 0 ? (
        <div className="flex h-64 items-center justify-center border text-sm text-muted-foreground">No derived data.</div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label={output.view.title ?? `${output.view.kind} chart`}>
          <ChartPlot rows={output.rows} view={output.view} />
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        {output.resultCount} derived rows. Sandbox-derived from {output.provenance.sourceTable.sheetName} {output.provenance.sourceTable.range}.
      </p>
    </section>
  );
}
