import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  LocalRuntimeResponse,
  LocalSessionSummary,
  LocalSessionsResponse,
  SandboxMetricSummary,
} from "./local-diagnostics-contracts";

const SESSION_FILE = /^(wrun_[A-Za-z0-9]+)\.json$/;
const SESSION_LIMIT = 50;
const EVE_SANDBOX_PREFIX = "eve-sbx-ses-";

type RuntimeMetric = {
  readonly cpuPercent: number;
  readonly memoryBytes: number;
  readonly timestamp: Date;
  readonly uptimeMs: number;
};

export async function listLocalSessions(runDirectory = defaultRunDirectory()): Promise<LocalSessionsResponse> {
  let names: string[];
  try {
    names = await readdir(runDirectory);
  } catch (error: unknown) {
    if (isMissingDirectory(error)) {
      return { sessions: [], source: "eve-local-run-manifests", truncated: false };
    }
    throw error;
  }

  const sessions: Array<LocalSessionSummary & { readonly updatedAtMs: number }> = [];
  for (const name of names) {
    const match = SESSION_FILE.exec(name);
    if (!match) continue;
    const entry = join(runDirectory, name);
    try {
      const stat = await lstat(entry);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      sessions.push({
        sessionId: match[1],
        updatedAt: stat.mtime.toISOString(),
        updatedAtMs: stat.mtimeMs,
      });
    } catch (error: unknown) {
      if (!isMissingDirectory(error)) {
        console.warn("Skipping unreadable local Eve session manifest.", { entry });
      }
    }
  }

  sessions.sort((left, right) => right.updatedAtMs - left.updatedAtMs || left.sessionId.localeCompare(right.sessionId));
  const truncated = sessions.length > SESSION_LIMIT;
  return {
    sessions: sessions.slice(0, SESSION_LIMIT).map(({ sessionId, updatedAt }) => ({ sessionId, updatedAt })),
    source: "eve-local-run-manifests",
    truncated,
  };
}

export async function readLocalRuntime({
  fetchInfo,
  getMetrics,
  now = () => new Date(),
}: {
  readonly fetchInfo: () => Promise<unknown>;
  readonly getMetrics: () => Promise<Record<string, RuntimeMetric>>;
  readonly now?: () => Date;
}): Promise<LocalRuntimeResponse> {
  const [eve, microsandbox] = await Promise.all([readEveInfo(fetchInfo), readMetrics(getMetrics)]);
  return { generatedAt: now().toISOString(), eve, microsandbox };
}

export async function fetchEveInfo(url: URL): Promise<unknown> {
  const response = await fetch(new URL("/eve/v1/info", url), { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) {
    throw new Error(`Eve info request failed with ${response.status}.`);
  }
  return response.json();
}

export async function getHostMetrics(): Promise<Record<string, RuntimeMetric>> {
  const { allSandboxMetrics, Sandbox } = await import("microsandbox");
  const [metrics, sandboxes] = await Promise.all([allSandboxMetrics(), Sandbox.list()]);
  const activeNames = new Set(
    sandboxes
      .filter((sandbox) => sandbox.status === "running" || sandbox.status === "draining")
      .map((sandbox) => sandbox.name),
  );
  return Object.fromEntries(Object.entries(metrics).filter(([name]) => activeNames.has(name)));
}

export function isLocalDiagnosticsRequest(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = hostnameFrom(request.headers.get("host"));
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (host === "localhost" || host === "127.0.0.1" || host === "::1") &&
    (forwardedFor === undefined || forwardedFor === "127.0.0.1" || forwardedFor === "::1" || forwardedFor === "::ffff:127.0.0.1");
}

function defaultRunDirectory(): string {
  return join(process.cwd(), ".eve", ".workflow-data", "streams", "runs");
}

async function readEveInfo(fetchInfo: () => Promise<unknown>): Promise<LocalRuntimeResponse["eve"]> {
  try {
    const info = asRecord(await fetchInfo());
    const agent = asRecord(info?.agent);
    const model = asRecord(agent?.model);
    const sandbox = asRecord(info?.sandbox);
    const tools = asRecord(info?.tools);
    const skills = asRecord(info?.skills);
    const toolNames = namesFrom(tools?.available);
    const skillNames = namesFrom(skills?.static);
    if (!agent) {
      return { reachable: false, error: "invalid_info" };
    }
    return {
      reachable: true,
      model: stringAt(model?.id),
      sandboxBackend: stringAt(sandbox?.backend) ?? stringAt(asRecord(sandbox?.backend)?.name) ?? "microsandbox (configured)",
      skillNames,
      toolNames,
    };
  } catch {
    return { reachable: false, error: "unreachable" };
  }
}

async function readMetrics(getMetrics: () => Promise<Record<string, RuntimeMetric>>): Promise<LocalRuntimeResponse["microsandbox"]> {
  try {
    const metrics = await getMetrics();
    const sandboxes = Object.entries(metrics)
      .map(([name, metric]) => ({
        cpuPercent: metric.cpuPercent,
        memoryBytes: metric.memoryBytes,
        name,
        timestamp: metric.timestamp.toISOString(),
        uptimeMs: metric.uptimeMs,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const eveManaged = sandboxes.filter((sandbox) => sandbox.name.startsWith(EVE_SANDBOX_PREFIX));
    return {
      eveManagedSandboxCount: sandboxes.length > 0 && eveManaged.length === 0 ? null : eveManaged.length,
      mappingStatus: sandboxes.length > 0 && eveManaged.length === 0 ? "unavailable" : "heuristic",
      runningSandboxCount: sandboxes.length,
      sandboxes,
    };
  } catch {
    return {
      error: "unavailable",
      eveManagedSandboxCount: null,
      mappingStatus: "unavailable",
      runningSandboxCount: 0,
      sandboxes: [],
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function namesFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => stringAt(asRecord(item)?.name))
    .filter((name): name is string => name !== undefined)
    .sort();
}

function stringAt(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isMissingDirectory(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function hostnameFrom(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("[")) {
    const end = normalized.indexOf("]");
    return end > 1 ? normalized.slice(1, end) : undefined;
  }
  return normalized.split(":")[0];
}
