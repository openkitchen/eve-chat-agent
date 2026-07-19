import { isLocalDiagnosticsRequest, listLocalSessions } from "@/lib/local-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLocalDiagnosticsRequest(request)) {
    return new Response("Not Found", { status: 404 });
  }
  return Response.json(await listLocalSessions());
}
