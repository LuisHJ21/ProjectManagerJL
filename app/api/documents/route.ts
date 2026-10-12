import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type User = { id: string; role: string };
type DocumentRow = { id: string; project_id: string; file_name: string; object_key: string; mime_type: string; size_bytes: number; uploaded_by: string; created_at: string };
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
const extensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "csv", "png", "jpg", "jpeg"]);
const maxBytes = 20 * 1024 * 1024;

async function currentUser(): Promise<User | null> {
  const auth = await getChatGPTUser();
  if (!auth || !env.DB) return null;
  return await env.DB.prepare("SELECT id,role FROM users WHERE auth_id=? OR lower(email)=? LIMIT 1").bind(auth.userId, auth.email.trim().toLowerCase()).first<User>();
}

async function canAccess(projectId: string, user: User) {
  if (!env.DB || !projectId) return false;
  if (user.role === "coordinator") return !!await env.DB.prepare("SELECT 1 FROM projects WHERE id=?").bind(projectId).first();
  return !!await env.DB.prepare(`SELECT 1 FROM projects p WHERE p.id=? AND (
    EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?)
    OR EXISTS (SELECT 1 FROM tasks t LEFT JOIN task_assignees ta ON ta.task_id=t.id WHERE t.project_id=p.id AND (ta.user_id=? OR t.assignee_id=?))
  )`).bind(projectId, user.id, user.id, user.id).first();
}

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Debes iniciar sesión", 401);
    if (!env.DB || !env.BUCKET) return fail("Almacenamiento no disponible", 503);
    const url = new URL(request.url);
    const downloadId = url.searchParams.get("download");
    if (downloadId) {
      const doc = await env.DB.prepare("SELECT * FROM project_documents WHERE id=?").bind(downloadId).first<DocumentRow>();
      if (!doc || !await canAccess(doc.project_id, user)) return fail("Documento no encontrado", 404);
      const object = await env.BUCKET.get(doc.object_key);
      if (!object) return fail("Archivo no disponible", 404);
      return new Response(object.body, { headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
        "Content-Length": String(object.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      } });
    }
    const projectId = url.searchParams.get("projectId") || "";
    if (!await canAccess(projectId, user)) return fail("Proyecto no encontrado", 404);
    const docs = await env.DB.prepare("SELECT d.id,d.project_id,d.file_name,d.mime_type,d.size_bytes,d.uploaded_by,d.created_at,u.name AS uploaded_by_name FROM project_documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.project_id=? ORDER BY d.created_at DESC").bind(projectId).all();
    return Response.json({ documents: docs.results });
  } catch (error) { console.error(error); return fail("No se pudieron cargar los documentos", 500); }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("Debes iniciar sesión", 401);
    if (!env.DB || !env.BUCKET) return fail("Almacenamiento no disponible", 503);
    if (Number(request.headers.get("content-length") || 0) > maxBytes + 1024 * 1024) return fail("El archivo supera el límite de 20 MB", 413);
    const form = await request.formData();
    const projectId = String(form.get("projectId") || "");
    if (!await canAccess(projectId, user)) return fail("Proyecto no encontrado", 404);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > maxBytes) return fail("Selecciona un archivo de hasta 20 MB");
    const name = file.name.replace(/[\\/\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
    const extension = name.split(".").at(-1)?.toLowerCase() || "";
    if (!name || !extensions.has(extension)) return fail("Formato no permitido. Usa PDF, Office, texto o imagen");
    const id = crypto.randomUUID();
    const objectKey = `projects/${projectId}/${id}`;
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    try {
      await env.DB.prepare("INSERT INTO project_documents (id,project_id,file_name,object_key,mime_type,size_bytes,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(id, projectId, name, objectKey, (file.type || "application/octet-stream").slice(0, 120), file.size, user.id, new Date().toISOString()).run();
    } catch (error) {
      await env.BUCKET.delete(objectKey);
      throw error;
    }
    return Response.json({ ok: true, id });
  } catch (error) { console.error(error); return fail("No se pudo subir el documento", 500); }
}
