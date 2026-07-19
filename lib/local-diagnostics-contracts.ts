export type LocalSessionSummary = {
  readonly sessionId: string;
  readonly updatedAt: string;
};

export type LocalSessionsResponse = {
  readonly sessions: readonly LocalSessionSummary[];
  readonly source: "eve-local-run-manifests";
  readonly truncated: boolean;
};

export type SandboxMetricSummary = {
  readonly name: string;
  readonly cpuPercent: number;
  readonly memoryBytes: number;
  readonly uptimeMs: number;
  readonly timestamp: string;
};

export type LocalRuntimeResponse = {
  readonly generatedAt: string;
  readonly eve: {
    readonly reachable: boolean;
    readonly model?: string;
    readonly sandboxBackend?: string;
    readonly toolNames?: readonly string[];
    readonly skillNames?: readonly string[];
    readonly error?: "unreachable" | "invalid_info";
  };
  readonly microsandbox: {
    readonly runningSandboxCount: number;
    readonly eveManagedSandboxCount: number | null;
    readonly mappingStatus: "heuristic" | "unavailable";
    readonly sandboxes: readonly SandboxMetricSummary[];
    readonly error?: "unavailable";
  };
};
