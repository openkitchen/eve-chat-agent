import { fetchEveInfo, getHostMetrics, readLocalRuntime } from "@/lib/local-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return Response.json(await readLocalRuntime({
    fetchInfo: () => fetchEveInfo(new URL(request.url)),
    getMetrics: getHostMetrics,
  }));
}
