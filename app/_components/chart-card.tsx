"use client";

import type { z } from "zod";
import { BarChart3Icon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type dataViewSchema, type queryTableOutputSchema, type rowSchema } from "@/lib/file-artifacts/contracts";
import { CardFooter, CardHeading } from "./data-table-card";

type QueryOutput = z.infer<typeof queryTableOutputSchema>;

export function ChartCard({ output }: { readonly output: QueryOutput }) {
  const view = output.view;
  if (!view || view.type !== "chart") {
    return null;
  }

  return (
    <section className="space-y-3">
      <CardHeading icon={<BarChart3Icon className="size-4" />} output={output} />
      {output.rows.length === 0 ? (
        <div className="flex h-64 items-center justify-center border text-sm text-muted-foreground">No matching data.</div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label={view.title ?? `${view.kind} chart`}>
          <ChartPlot rows={output.rows} view={view} />
        </div>
      )}
      <CardFooter output={output} />
    </section>
  );
}

type ChartView = Extract<z.infer<typeof dataViewSchema>, { type: "chart" }>;
type ChartRow = z.infer<typeof rowSchema>;

export function ChartPlot({ rows, view }: { readonly rows: readonly ChartRow[]; readonly view: ChartView }) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      {renderChart(rows, view)}
    </ResponsiveContainer>
  );
}

function renderChart(rows: readonly ChartRow[], view: ChartView) {
  if (view.kind === "line") {
    return (
      <LineChart data={rows} margin={{ bottom: 4, left: 4, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={view.x} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line dataKey={view.y} dot={false} name={view.y} stroke="#0f766e" strokeWidth={2} type="monotone" />
      </LineChart>
    );
  }
  if (view.kind === "bar") {
    return (
      <BarChart data={rows} margin={{ bottom: 4, left: 4, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={view.x} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={view.y} fill="#2563eb" name={view.y} />
      </BarChart>
    );
  }
  const histogramRows = rows.map((row) => ({
    ...row,
    label: `${row.binStart}-${row.binEnd}`,
  }));
  return (
    <BarChart data={histogramRows} margin={{ bottom: 16, left: 4, right: 12, top: 8 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="label" interval="preserveStartEnd" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="count" fill="#c2410c" name="count" />
    </BarChart>
  );
}
