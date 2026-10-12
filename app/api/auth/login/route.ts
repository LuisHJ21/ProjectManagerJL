import { env } from "cloudflare:workers";
import { createSession, sessionCookieHeader, verifyPassword } from "../../../../lib/team-auth";

export const dynamic = "force-dynamic";
const invalid = () => Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });

export async function POST(request: Request) {
  try {
    if (!env.DB) return Response.json({ error: "Servicio no disponible" }, { status: 503 });
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase().slice(0, 80) : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || password.length > 200) return invalid();
    const client = request.headers.get("cf-connecting-ip") || "unknown";
    const key = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${client}:${username}`)))).map(byte => byte.toString(16).padStart(2, "0")).join("");
    const now = new Date();
    const attempt = await env.DB.prepare("SELECT failures,window_start FROM login_attempts WHERE key=?").bind(key).first<{ failures: number; window_start: string }>();
    const activeWindow = !!attempt && now.getTime() - Date.parse(attempt.window_start) < 15 * 60_000;
    if (activeWindow && attempt.failures >= 6) return Response.json({ error: "Demasiados intentos. Espera 15 minutos" }, { status: 429 });
    const user = await env.DB.prepare("SELECT id,password_hash FROM users WHERE lower(username)=?").bind(username).first<{ id: string; password_hash: string | null }>();
    const valid = user?.password_hash ? await verifyPassword(password, user.password_hash) : false;
    if (!valid || !user) {
      await env.DB.prepare("INSERT INTO login_attempts (key,failures,window_start) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start")
        .bind(key, activeWindow ? attempt!.failures + 1 : 1, activeWindow ? attempt!.window_start : now.toISOString()).run();
      return invalid();
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE key=?").bind(key).run();
    await env.DB.prepare("DELETE FROM user_sessions WHERE expires_at<?").bind(now.toISOString()).run();
    const token = await createSession(user.id);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(token, new URL(request.url).protocol === "https:"), "Cache-Control": "no-store" } });
  } catch (error) { console.error(error); return Response.json({ error: "No se pudo iniciar sesión" }, { status: 500 }); }
}
