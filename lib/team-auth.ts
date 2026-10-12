import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getChatGPTUser } from "../app/chatgpt-auth";

export type AppUser = { id: string; email: string; name: string; role: "coordinator" | "staff"; username: string | null; auth_id?: string | null };
export const sessionCookie = "nexo_session";
const sessionDays = 7;
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const digestHex = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)))).map(byte => byte.toString(16).padStart(2, "0")).join("");

export async function getSessionUser(): Promise<AppUser | null> {
  if (!env.DB) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  return await env.DB.prepare("SELECT u.id,u.email,u.name,u.role,u.username FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?")
    .bind(await digestHex(token), new Date().toISOString()).first<AppUser>();
}

export async function getAuthenticatedUser(): Promise<AppUser | null> {
  if (!env.DB) return null;
  const auth = await getChatGPTUser();
  if (auth) {
    const email = auth.email.trim().toLowerCase();
    let user = await env.DB.prepare("SELECT id,email,name,role,username,auth_id FROM users WHERE auth_id=? OR lower(email)=? LIMIT 1").bind(auth.userId, email).first<AppUser>();
    if (!user) {
      const count = await env.DB.prepare("SELECT count(*) AS n FROM users").first<{ n: number }>();
      if (count?.n === 0) {
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO users (id,email,name,role,auth_id,created_at) VALUES (?,?,?,?,?,?)")
          .bind(id, email, auth.fullName || auth.displayName, "coordinator", auth.userId, new Date().toISOString()).run();
        user = await env.DB.prepare("SELECT id,email,name,role,username,auth_id FROM users WHERE id=?").bind(id).first<AppUser>();
      }
    } else if (!user.auth_id) {
      await env.DB.prepare("UPDATE users SET auth_id=? WHERE id=?").bind(auth.userId, user.id).run();
      user.auth_id = auth.userId;
    }
    if (user) return user;
  }
  return getSessionUser();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 }, key, 256));
  return `pbkdf2-sha256$210000$${base64(salt)}$${base64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, rounds, saltText, hashText] = stored.split("$");
  if (algorithm !== "pbkdf2-sha256" || rounds !== "210000" || !saltText || !hashText) return false;
  const decode = (text: string) => Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
  const salt = decode(saltText), expected = decode(hashText);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 }, key, expected.length * 8));
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(20);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

export async function generateUsername(name: string) {
  if (!env.DB) throw new Error("Base de datos no disponible");
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24) || "usuario";
  let candidate = base;
  for (let suffix = 2; suffix < 10_000; suffix++) {
    if (!await env.DB.prepare("SELECT 1 FROM users WHERE lower(username)=?").bind(candidate).first()) return candidate;
    candidate = `${base}.${suffix}`;
  }
  throw new Error("No se pudo generar un usuario único");
}

export async function createSession(userId: string) {
  if (!env.DB) throw new Error("Base de datos no disponible");
  const token = base64(randomBytes(32));
  const now = new Date();
  const expires = new Date(now.getTime() + sessionDays * 86_400_000);
  await env.DB.prepare("INSERT INTO user_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(await digestHex(token), userId, now.toISOString(), expires.toISOString()).run();
  return token;
}

export async function revokeSession(token: string) {
  if (env.DB && token) await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash=?").bind(await digestHex(token)).run();
}

export function sessionCookieHeader(token: string, secure: boolean) {
  return `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 86400}${secure ? "; Secure" : ""}`;
}
