import { fetchEveInfo, getHostMetrics, isLocalDiagnosticsRequest, readLocalRuntime } from "@/lib/local-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLocalDiagnosticsRequest(request)) {
    return new Response("Not Found", { status: 404 });
  }
  return Response.json(await readLocalRuntime({
    fetchInfo: () => fetchEveInfo(new URL(request.url)),
    getMetrics: getHostMetrics,
  }));
}
