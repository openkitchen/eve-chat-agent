"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { z } from "zod";
import { BarChart3Icon } from "lucide-react";
import { type drawChartOutputSchema } from "@/lib/file-artifacts/contracts";

type DrawChartOutput = z.infer<typeof drawChartOutputSchema>;

const COLORS = ["#0f766e", "#2563eb", "#c2410c", "#be123c", "#7c3aed", "#0369a1"];

export function DrawChartCard({ output }: { readonly output: DrawChartOutput }) {
  const title = output.spec.title ?? (output.spec.series.length === 1 ? output.spec.series[0]?.name ?? output.spec.series[0]?.dataKey : "Chart");
  return (
    <section className="space-y-3 rounded-[10px] border border-black/[.06] bg-white p-4">
      <div className="flex items-center gap-2 text-sm">
        <BarChart3Icon className="size-4 text-muted-foreground" />
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{output.provenance.rowCount} rows</span>
      </div>
      {output.data.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-[10px] border border-black/[.06] text-sm text-muted-foreground">No chart data.</div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer height="100%" width="100%">
            {output.spec.chart.type === "line" ? renderLineChart(output) : renderBarChart(output)}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function renderLineChart(output: DrawChartOutput) {
  return (
    <LineChart data={output.data} margin={output.spec.chart.margin}>
      {renderSharedParts(output)}
      {output.spec.series.map((series, index) => (
        <Line
          dataKey={series.dataKey}
          dot={series.dot ?? false}
          key={series.dataKey}
          name={series.name ?? series.dataKey}
          stroke={series.color ?? COLORS[index % COLORS.length]}
          strokeWidth={series.strokeWidth ?? 2}
          type="monotone"
          yAxisId={series.yAxisId ?? "left"}
        />
      ))}
    </LineChart>
  );
}

function renderBarChart(output: DrawChartOutput) {
  return (
    <BarChart data={output.data} margin={output.spec.chart.margin}>
      {renderSharedParts(output)}
      {output.spec.series.map((series, index) => (
        <Bar
          dataKey={series.dataKey}
          fill={series.color ?? COLORS[index % COLORS.length]}
          key={series.dataKey}
          name={series.name ?? series.dataKey}
          stackId={series.stackId}
          yAxisId={series.yAxisId ?? "left"}
        />
      ))}
    </BarChart>
  );
}

function renderSharedParts(output: DrawChartOutput) {
  const yAxes = output.spec.yAxes?.length ? output.spec.yAxes : [{ id: "left" as const }];
  return (
    <>
      {output.spec.grid?.show ? <CartesianGrid strokeDasharray="3 3" /> : null}
      <XAxis
        dataKey={output.spec.xAxis.dataKey}
        interval={output.spec.xAxis.interval === "auto" ? undefined : output.spec.xAxis.interval}
        label={output.spec.xAxis.label}
        type={output.spec.xAxis.type}
      />
      {yAxes.map((axis) => (
        <YAxis
          domain={axis.domain === "zeroToDataMax" ? [0, "dataMax"] : axis.domain === "auto" ? undefined : axis.domain}
          key={axis.id}
          label={axis.label}
          scale={axis.scale}
          yAxisId={axis.id}
        />
      ))}
      {output.spec.tooltip?.show ? <Tooltip shared={output.spec.tooltip.shared} /> : null}
      {output.spec.legend?.show ? <Legend verticalAlign={output.spec.legend.verticalAlign} /> : null}
    </>
  );
}
