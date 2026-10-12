import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
const domains = ["stakeholders", "team", "development", "planning", "project-work", "delivery", "measurement", "uncertainty"];
const statuses = ["todo", "progress", "review", "done"];
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
const value = (v: unknown, max = 300) => typeof v === "string" ? v.trim().slice(0, max) : "";
const date = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(value(v)) ? value(v) : null;
const id = () => crypto.randomUUID();
const db = () => { if (!env.DB) throw new Error("Base de datos no disponible"); return env.DB; };

async function identity() {
  const auth = await getChatGPTUser();
  if (!auth) return null;
  const database = db();
  const email = auth.email.trim().toLowerCase();
  let user = await database.prepare("SELECT * FROM users WHERE auth_id = ? OR lower(email) = ? LIMIT 1").bind(auth.userId, email).first<Row>();
  if (!user) {
    const count = await database.prepare("SELECT count(*) AS n FROM users").first<{ n: number }>();
    if (count?.n !== 0) return { pending: true as const, email };
    const uid = id();
    await database.prepare("INSERT INTO users (id,email,name,role,auth_id,created_at) VALUES (?,?,?,?,?,?)").bind(uid, email, auth.fullName || auth.displayName, "coordinator", auth.userId, new Date().toISOString()).run();
    user = await database.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first<Row>();
  } else if (!user.auth_id) {
    await database.prepare("UPDATE users SET auth_id = ? WHERE id = ?").bind(auth.userId, user.id).run();
    user.auth_id = auth.userId;
  }
  return user;
}

export async function GET() {
  try {
    const user = await identity();
    if (!user) return fail("Debes iniciar sesión", 401);
    if ("pending" in user) return Response.json({ pending: true, email: user.email });
    const database = db();
    const coordinator = user.role === "coordinator";
    const [projects, tasks, users, members] = await Promise.all([
      database.prepare(coordinator ? "SELECT * FROM projects ORDER BY created_at DESC" : "SELECT DISTINCT p.* FROM projects p LEFT JOIN project_members m ON m.project_id=p.id WHERE m.user_id=? OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.assignee_id=?) ORDER BY p.created_at DESC").bind(...(coordinator ? [] : [user.id, user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM tasks ORDER BY created_at DESC" : "SELECT * FROM tasks WHERE assignee_id=? ORDER BY created_at DESC").bind(...(coordinator ? [] : [user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT id,email,name,role,created_at FROM users ORDER BY name" : "SELECT id,email,name,role,created_at FROM users WHERE id=?").bind(...(coordinator ? [] : [user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM project_members" : "SELECT * FROM project_members WHERE user_id=?").bind(...(coordinator ? [] : [user.id])).all<Row>(),
    ]);
    return Response.json({ user, projects: projects.results, tasks: tasks.results, users: users.results, members: members.results });
  } catch (error) { console.error(error); return fail("No se pudieron cargar los datos", 500); }
}

export async function POST(request: Request) {
  try {
    const user = await identity();
    if (!user) return fail("Debes iniciar sesión", 401);
    if ("pending" in user) return fail("Tu cuenta aún no ha sido invitada", 403);
    const body = await request.json() as Record<string, unknown>;
    const operation = value(body.operation, 40);
    const database = db();
    const coordinator = user.role === "coordinator";
    if (operation === "member") {
      if (!coordinator) return fail("Acceso denegado", 403);
      const email = value(body.email, 254).toLowerCase();
      const name = value(body.name, 100);
      const role = body.role === "coordinator" ? "coordinator" : "staff";
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Nombre o correo no válido");
      await database.prepare("INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?)").bind(id(), email, name, role, new Date().toISOString()).run();
    } else if (operation === "role") {
      if (!coordinator) return fail("Acceso denegado", 403);
      const target = value(body.id, 40);
      if (target === user.id) return fail("No puedes cambiar tu propio rol");
      if (!["coordinator", "staff"].includes(value(body.role))) return fail("Rol no válido");
      await database.prepare("UPDATE users SET role=? WHERE id=?").bind(body.role, target).run();
    } else if (operation === "project") {
      if (!coordinator) return fail("Acceso denegado", 403);
      const name = value(body.name, 120), code = value(body.code, 24).toUpperCase();
      if (!name || !code) return fail("Completa el nombre y código");
      const approach = ["predictive", "adaptive", "hybrid"].includes(value(body.approach)) ? body.approach : "hybrid";
      const start = date(body.plannedStart), end = date(body.plannedEnd);
      if (start && end && end < start) return fail("La fecha final debe ser posterior al inicio");
      await database.prepare("INSERT INTO projects (id,name,code,description,objective,approach,status,planned_start,planned_end,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id(), name, code, value(body.description, 1000), value(body.objective, 1000), approach, "planning", start, end, user.id, new Date().toISOString()).run();
    } else if (operation === "projectStatus") {
      if (!coordinator) return fail("Acceso denegado", 403);
      if (!["planning", "active", "completed"].includes(value(body.status))) return fail("Estado no válido");
      await database.prepare("UPDATE projects SET status=? WHERE id=?").bind(body.status, value(body.id, 40)).run();
    } else if (operation === "assignMember") {
      if (!coordinator) return fail("Acceso denegado", 403);
      const projectId = value(body.projectId, 40), userId = value(body.userId, 40);
      const project = await database.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
      const member = await database.prepare("SELECT id FROM users WHERE id=?").bind(userId).first();
      if (!project || !member) return fail("Proyecto o persona no encontrados");
      await database.prepare("INSERT INTO project_members (project_id,user_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM project_members WHERE project_id=? AND user_id=?)").bind(projectId,userId,projectId,userId).run();
    } else if (operation === "task") {
      if (!coordinator) return fail("Acceso denegado", 403);
      const title = value(body.title, 160), projectId = value(body.projectId, 40);
      if (!title || !projectId) return fail("Completa la tarea y el proyecto");
      const project = await database.prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
      if (!project) return fail("Proyecto no encontrado");
      const assigneeId = value(body.assigneeId, 40) || null;
      if (assigneeId && !await database.prepare("SELECT id FROM users WHERE id=?").bind(assigneeId).first()) return fail("Responsable no encontrado");
      const start = date(body.plannedStart), end = date(body.plannedEnd);
      if (start && end && end < start) return fail("La fecha final debe ser posterior al inicio");
      const hours = Number(body.estimatedHours);
      if (!Number.isInteger(hours) || hours < 0 || hours > 100000) return fail("Horas estimadas no válidas");
      const domain = domains.includes(value(body.domain)) ? body.domain : "delivery";
      const priority = ["low", "medium", "high"].includes(value(body.priority)) ? body.priority : "medium";
      await database.prepare("INSERT INTO tasks (id,project_id,title,description,domain,assignee_id,status,priority,estimated_hours,planned_start,planned_end,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id(), projectId, title, value(body.description, 1000), domain, assigneeId, "todo", priority, hours, start, end, new Date().toISOString()).run();
      if (assigneeId) await database.prepare("INSERT INTO project_members (project_id,user_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM project_members WHERE project_id=? AND user_id=?)").bind(projectId,assigneeId,projectId,assigneeId).run();
    } else if (operation === "taskProgress") {
      const taskId = value(body.id, 40), status = value(body.status, 20);
      if (!statuses.includes(status)) return fail("Estado no válido");
      const task = await database.prepare("SELECT assignee_id FROM tasks WHERE id=?").bind(taskId).first<{assignee_id:string|null}>();
      if (!task) return fail("Tarea no encontrada", 404);
      if (!coordinator && task.assignee_id !== user.id) return fail("Acceso denegado", 403);
      const actualStart = date(body.actualStart), actualEnd = date(body.actualEnd);
      if (actualStart && actualEnd && actualEnd < actualStart) return fail("La fecha final real debe ser posterior al inicio");
      await database.prepare("UPDATE tasks SET status=?,actual_start=?,actual_end=? WHERE id=?").bind(status, actualStart, actualEnd, taskId).run();
    } else return fail("Operación no reconocida");
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return fail(error instanceof Error && /UNIQUE constraint failed/.test(error.message) ? "Ese correo ya está registrado" : "No se pudo guardar el cambio", 500);
  }
}
