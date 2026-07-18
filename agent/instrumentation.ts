import { OpenInferenceBatchSpanProcessor } from "@arizeai/openinference-vercel";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { defineInstrumentation } from "eve/instrumentation";

let telemetryInitialized = false;

export default defineInstrumentation({
  recordInputs: true,
  recordOutputs: true,
  setup({ agentName }) {
    if (process.env.PHOENIX_ENABLED === "false") return;
    if (telemetryInitialized) return;

    const collectorUrl =
      process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://127.0.0.1:6006/v1/traces";
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [SEMRESATTRS_PROJECT_NAME]: process.env.PHOENIX_PROJECT_NAME ?? agentName,
        "service.name": agentName,
      }),
      spanProcessors: [
        new OpenInferenceBatchSpanProcessor({
          exporter: new OTLPTraceExporter({ url: collectorUrl }),
          reparentOrphanedSpans: true,
        }),
      ],
    });

    provider.register();
    telemetryInitialized = true;
  },
});
