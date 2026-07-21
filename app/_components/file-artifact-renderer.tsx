"use client";

import type { EveDynamicToolPart } from "eve/react";
import {
  downloadTableOutputSchema,
  drawChartOutputSchema,
  materializeTableOutputSchema,
} from "@/lib/file-artifacts/contracts";
import { DownloadFileCard } from "./download-file-card";
import { DrawChartCard } from "./draw-chart-card";

export function FileArtifactRenderer({ part }: { readonly part: EveDynamicToolPart }) {
  if (part.state !== "output-available") {
    return null;
  }
  if (part.toolName === "download_table") {
    const result = downloadTableOutputSchema.safeParse(part.output);
    return result.success ? <DownloadFileCard output={result.data} /> : null;
  }
  if (part.toolName === "draw_chart") {
    const result = drawChartOutputSchema.safeParse(part.output);
    return result.success ? <DrawChartCard output={result.data} /> : null;
  }
  return null;
}

export function hasFileArtifactRenderer(part: EveDynamicToolPart): boolean {
  if (part.state !== "output-available") {
    return false;
  }
  if (part.toolName === "download_table") {
    return downloadTableOutputSchema.safeParse(part.output).success;
  }
  if (part.toolName === "draw_chart") {
    return drawChartOutputSchema.safeParse(part.output).success;
  }
  return part.toolName === "materialize_table" && materializeTableOutputSchema.safeParse(part.output).success;
}
