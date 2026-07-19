import { listLocalSessions } from "@/lib/local-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request) {
  return Response.json(await listLocalSessions());
}
