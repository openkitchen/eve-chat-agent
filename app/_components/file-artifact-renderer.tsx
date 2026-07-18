"use client";

import type { EveDynamicToolPart } from "eve/react";
import {
  exportTableOutputSchema,
  publishDerivedChartOutputSchema,
  queryTableOutputSchema,
} from "@/lib/file-artifacts/contracts";
import { ChartCard } from "./chart-card";
import { DataTableCard } from "./data-table-card";
import { DownloadFileCard } from "./download-file-card";
import { DerivedChartCard } from "./derived-chart-card";

export function FileArtifactRenderer({ part }: { readonly part: EveDynamicToolPart }) {
  if (part.state !== "output-available") {
    return null;
  }
  if (part.toolName === "query_table") {
    const result = queryTableOutputSchema.safeParse(part.output);
    if (!result.success || !result.data.view) {
      return null;
    }
    return result.data.view.type === "table" ? <DataTableCard output={result.data} /> : <ChartCard output={result.data} />;
  }
  if (part.toolName === "export_table") {
    const result = exportTableOutputSchema.safeParse(part.output);
    return result.success ? <DownloadFileCard output={result.data} /> : null;
  }
  if (part.toolName === "publish_derived_chart") {
    const result = publishDerivedChartOutputSchema.safeParse(part.output);
    return result.success ? <DerivedChartCard output={result.data} /> : null;
  }
  return null;
}

export function hasFileArtifactRenderer(part: EveDynamicToolPart): boolean {
  if (part.state !== "output-available") {
    return false;
  }
  if (part.toolName === "query_table") {
    const result = queryTableOutputSchema.safeParse(part.output);
    return result.success && result.data.view !== undefined;
  }
  if (part.toolName === "export_table") {
    return exportTableOutputSchema.safeParse(part.output).success;
  }
  return part.toolName === "publish_derived_chart" && publishDerivedChartOutputSchema.safeParse(part.output).success;
}
