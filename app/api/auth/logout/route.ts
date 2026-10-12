import { cookies } from "next/headers";
import { revokeSession, sessionCookie } from "../../../../lib/team-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = (await cookies()).get(sessionCookie)?.value || "";
  await revokeSession(token);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`, "Cache-Control": "no-store" } });
}
