import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
const statuses = ["todo", "progress", "review", "done"];
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
const value = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";
const date = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(value(v)) ? value(v) : null;
const uuid = () => crypto.randomUUID();
const db = () => { if (!env.DB) throw new Error("Base de datos no disponible"); return env.DB; };
const list = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x).map(x=>x.slice(0,40)))] : [];
const validRange = (start: string | null, end: string | null) => !start || !end || end >= start;

async function identity() {
  const auth = await getChatGPTUser();
  if (!auth) return null;
  const database = db();
  const email = auth.email.trim().toLowerCase();
  let user = await database.prepare("SELECT * FROM users WHERE auth_id = ? OR lower(email) = ? LIMIT 1").bind(auth.userId, email).first<Row>();
  if (!user) {
    const count = await database.prepare("SELECT count(*) AS n FROM users").first<{ n: number }>();
    if (count?.n !== 0) return { pending: true as const, email };
    const uid = uuid();
    await database.prepare("INSERT INTO users (id,email,name,role,auth_id,created_at) VALUES (?,?,?,?,?,?)").bind(uid, email, auth.fullName || auth.displayName, "coordinator", auth.userId, new Date().toISOString()).run();
    user = await database.prepare("SELECT * FROM users WHERE id = ?").bind(uid).first<Row>();
  } else if (!user.auth_id) {
    await database.prepare("UPDATE users SET auth_id = ? WHERE id = ?").bind(auth.userId, user.id).run();
    user.auth_id = auth.userId;
  }
  return user;
}

async function hasProject(projectId: string) {
  return db().prepare("SELECT id FROM projects WHERE id=?").bind(projectId).first();
}

async function validateAssignees(ids: string[]) {
  if (!ids.length) return false;
  for (const id of ids) if (!await db().prepare("SELECT id FROM users WHERE id=?").bind(id).first()) return false;
  return true;
}

async function validateStage(stageId: string | null, projectId: string) {
  return !stageId || !!await db().prepare("SELECT id FROM stages WHERE id=? AND project_id=?").bind(stageId, projectId).first();
}

async function setAssignees(taskId: string, projectId: string, ids: string[]) {
  const database = db();
  const statements = [database.prepare("DELETE FROM task_assignees WHERE task_id=?").bind(taskId)];
  for (const uid of ids) {
    statements.push(database.prepare("INSERT INTO task_assignees (task_id,user_id) VALUES (?,?)").bind(taskId,uid));
    statements.push(database.prepare("INSERT INTO project_members (project_id,user_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM project_members WHERE project_id=? AND user_id=?)").bind(projectId,uid,projectId,uid));
  }
  await database.batch(statements);
}

export async function GET() {
  try {
    const user = await identity();
    if (!user) return fail("Debes iniciar sesión", 401);
    if ("pending" in user) return Response.json({ pending: true, email: user.email });
    const database = db(), coordinator = user.role === "coordinator";
    const projectWhere = "EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?) OR EXISTS (SELECT 1 FROM tasks t LEFT JOIN task_assignees ta ON ta.task_id=t.id WHERE t.project_id=p.id AND (ta.user_id=? OR t.assignee_id=?))";
    const [projects,tasks,users,members,groups,stages,stakeholders,assignees,reschedules] = await Promise.all([
      database.prepare(coordinator ? "SELECT * FROM projects ORDER BY created_at DESC" : `SELECT p.* FROM projects p WHERE ${projectWhere} ORDER BY p.created_at DESC`).bind(...(coordinator?[]:[user.id,user.id,user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM tasks ORDER BY created_at DESC" : "SELECT DISTINCT t.* FROM tasks t LEFT JOIN task_assignees a ON a.task_id=t.id WHERE a.user_id=? OR t.assignee_id=? ORDER BY t.created_at DESC").bind(...(coordinator?[]:[user.id,user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT id,email,name,role,created_at FROM users ORDER BY name" : "SELECT DISTINCT u.id,u.name,u.role FROM users u JOIN project_members m ON m.user_id=u.id WHERE m.project_id IN (SELECT project_id FROM project_members WHERE user_id=?) ORDER BY u.name").bind(...(coordinator?[]:[user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM project_members" : "SELECT * FROM project_members WHERE user_id=?").bind(...(coordinator?[]:[user.id])).all<Row>(),
      database.prepare("SELECT * FROM project_groups ORDER BY name").all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM stages ORDER BY sort_order,name" : "SELECT s.* FROM stages s JOIN projects p ON p.id=s.project_id WHERE " + projectWhere + " ORDER BY s.sort_order,s.name").bind(...(coordinator?[]:[user.id,user.id,user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM stakeholders ORDER BY name" : "SELECT s.* FROM stakeholders s JOIN projects p ON p.id=s.project_id WHERE " + projectWhere + " ORDER BY s.name").bind(...(coordinator?[]:[user.id,user.id,user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM task_assignees" : "SELECT a.* FROM task_assignees a WHERE a.user_id=? OR a.task_id IN (SELECT task_id FROM task_assignees WHERE user_id=?)").bind(...(coordinator?[]:[user.id,user.id])).all<Row>(),
      database.prepare(coordinator ? "SELECT * FROM task_reschedules ORDER BY created_at DESC" : "SELECT r.* FROM task_reschedules r WHERE r.task_id IN (SELECT task_id FROM task_assignees WHERE user_id=?) OR r.task_id IN (SELECT id FROM tasks WHERE assignee_id=?) ORDER BY r.created_at DESC").bind(...(coordinator?[]:[user.id,user.id])).all<Row>(),
    ]);
    return Response.json({user,projects:projects.results,tasks:tasks.results,users:users.results,members:members.results,groups:groups.results,stages:stages.results,stakeholders:stakeholders.results,assignees:assignees.results,reschedules:reschedules.results});
  } catch (error) { console.error(error); return fail("No se pudieron cargar los datos",500); }
}

export async function POST(request: Request) {
  try {
    const user = await identity();
    if (!user) return fail("Debes iniciar sesión",401);
    if ("pending" in user) return fail("Tu cuenta aún no ha sido invitada",403);
    const body = await request.json() as Record<string,unknown>;
    const operation = value(body.operation,40), database = db(), coordinator = user.role === "coordinator";
    if (operation !== "taskProgress" && !coordinator) return fail("Acceso denegado",403);

    if (operation === "member") {
      const email=value(body.email,254).toLowerCase(), name=value(body.name,100);
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Nombre o correo no válido");
      await database.prepare("INSERT INTO users (id,email,name,role,created_at) VALUES (?,?,?,?,?)").bind(uuid(),email,name,body.role==="coordinator"?"coordinator":"staff",new Date().toISOString()).run();
    } else if (operation === "role") {
      if (body.id===user.id) return fail("No puedes cambiar tu propio rol");
      if (!["coordinator","staff"].includes(value(body.role))) return fail("Rol no válido");
      await database.prepare("UPDATE users SET role=? WHERE id=?").bind(body.role,value(body.id,40)).run();
    } else if (operation === "project") {
      const name=value(body.name,120),code=value(body.code,24).toUpperCase();
      if (!name||!code) return fail("Completa el nombre y código");
      if (await database.prepare("SELECT id FROM projects WHERE code=?").bind(code).first()) return fail("Ese código ya está registrado");
      await database.prepare("INSERT INTO projects (id,name,code,description,objective,approach,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(uuid(),name,code,"","","hybrid","planning",user.id,new Date().toISOString()).run();
    } else if (operation === "projectProfile") {
      const projectId=value(body.id,40); if(!await hasProject(projectId)) return fail("Proyecto no encontrado",404);
      const amount=Number(body.budget);
      if (!Number.isFinite(amount)||amount<0||amount>1e12) return fail("Presupuesto no válido");
      const currency=["PEN","USD","EUR"].includes(value(body.currency))?body.currency:"PEN";
      await database.prepare("UPDATE projects SET description=?,scope=?,objective=?,risks=?,budget=?,currency=? WHERE id=?")
        .bind(value(body.description,3000),value(body.scope,3000),value(body.objective,3000),value(body.risks,3000),Math.round(amount*100),currency,projectId).run();
    } else if (operation === "projectStatus") {
      if (!["planning","active","completed"].includes(value(body.status))) return fail("Estado no válido");
      await database.prepare("UPDATE projects SET status=? WHERE id=?").bind(body.status,value(body.id,40)).run();
    } else if (operation === "group") {
      const name=value(body.name,80); if(!name)return fail("Indica un nombre para el grupo");
      await database.prepare("INSERT INTO project_groups (id,name,created_at) VALUES (?,?,?)").bind(uuid(),name,new Date().toISOString()).run();
    } else if (operation === "projectGroup") {
      const projectId=value(body.projectId,40),groupId=value(body.groupId,40)||null;
      if(!await hasProject(projectId)) return fail("Proyecto no encontrado",404);
      if(groupId&&!await database.prepare("SELECT id FROM project_groups WHERE id=?").bind(groupId).first()) return fail("Grupo no encontrado");
      await database.prepare("UPDATE projects SET group_id=? WHERE id=?").bind(groupId,projectId).run();
    } else if (operation === "stage") {
      const projectId=value(body.projectId,40),name=value(body.name,100);
      if(!name||!await hasProject(projectId))return fail("Indica una etapa y un proyecto válido");
      const order=await database.prepare("SELECT count(*) AS n FROM stages WHERE project_id=?").bind(projectId).first<{n:number}>();
      await database.prepare("INSERT INTO stages (id,project_id,name,sort_order) VALUES (?,?,?,?)").bind(uuid(),projectId,name,order?.n||0).run();
    } else if (operation === "stakeholder") {
      const projectId=value(body.projectId,40),name=value(body.name,120),raci=value(body.raci,1).toUpperCase();
      if(!name||!await hasProject(projectId)||!["R","A","C","I"].includes(raci)) return fail("Datos del interesado no válidos");
      const stakeholderId=value(body.id,40);
      if (stakeholderId) {
        await database.prepare("UPDATE stakeholders SET name=?,organization=?,role=?,raci=? WHERE id=? AND project_id=?")
          .bind(name,value(body.organization,120),value(body.roleName,120),raci,stakeholderId,projectId).run();
      } else {
        await database.prepare("INSERT INTO stakeholders (id,project_id,name,organization,role,raci) VALUES (?,?,?,?,?,?)")
          .bind(uuid(),projectId,name,value(body.organization,120),value(body.roleName,120),raci).run();
      }
    } else if (operation === "assignMember") {
      const projectId=value(body.projectId,40),userId=value(body.userId,40);
      if(!await hasProject(projectId)||!await database.prepare("SELECT id FROM users WHERE id=?").bind(userId).first()) return fail("Proyecto o persona no encontrados");
      await database.prepare("INSERT INTO project_members (project_id,user_id) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM project_members WHERE project_id=? AND user_id=?)").bind(projectId,userId,projectId,userId).run();
    } else if (operation === "task" || operation === "taskManage") {
      const projectId=value(body.projectId,40),title=value(body.title,160),taskId=value(body.id,40);
      if(!title||!await hasProject(projectId))return fail("Completa la tarea y el proyecto");
      const ids=list(body.assigneeIds);
      if(!await validateAssignees(ids))return fail("Selecciona uno o más responsables válidos");
      const stageId=value(body.stageId,40)||null;
      if(!await validateStage(stageId,projectId))return fail("La etapa no pertenece al proyecto");
      const start=date(body.plannedStart),end=date(body.plannedEnd);
      if(!start||!end||!validRange(start,end))return fail("Indica fechas planificadas válidas");
      const kind=body.kind==="milestone"?"milestone":"activity";
      const hours=kind==="milestone"?0:Number(body.estimatedHours);
      if(!Number.isInteger(hours)||hours<0||hours>100000)return fail("Horas estimadas no válidas");
      const priority=["low","medium","high"].includes(value(body.priority))?body.priority:"medium";
      if(operation==="task") {
        const newId=uuid();
        await database.prepare("INSERT INTO tasks (id,project_id,title,description,domain,assignee_id,status,priority,estimated_hours,planned_start,planned_end,created_at,kind,stage_id,progress) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(newId,projectId,title,value(body.description,1000),"delivery",ids[0],"todo",priority,hours,start,end,new Date().toISOString(),kind,stageId,0).run();
        await setAssignees(newId,projectId,ids);
      } else {
        const old=await database.prepare("SELECT * FROM tasks WHERE id=? AND project_id=?").bind(taskId,projectId).first<Row>();
        if(!old)return fail("Tarea no encontrada",404);
        const datesChanged=old.planned_start!==start||old.planned_end!==end;
        const reason=value(body.reason,500);
        if(datesChanged&&!reason)return fail("Indica el motivo de la reprogramación");
        const statements=[database.prepare("UPDATE tasks SET title=?,description=?,priority=?,estimated_hours=?,planned_start=?,planned_end=?,kind=?,stage_id=?,assignee_id=? WHERE id=?")
          .bind(title,value(body.description,1000),priority,hours,start,end,kind,stageId,ids[0],taskId)];
        if(datesChanged) statements.push(database.prepare("INSERT INTO task_reschedules (id,task_id,old_start,old_end,new_start,new_end,reason,changed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(uuid(),taskId,old.planned_start,old.planned_end,start,end,reason,user.id,new Date().toISOString()));
        await database.batch(statements);
        await setAssignees(taskId,projectId,ids);
      }
    } else if (operation === "taskProgress") {
      const taskId=value(body.id,40),status=value(body.status,20);
      if(!statuses.includes(status))return fail("Estado no válido");
      const task=await database.prepare("SELECT assignee_id FROM tasks WHERE id=?").bind(taskId).first<{assignee_id:string|null}>();
      if(!task)return fail("Tarea no encontrada",404);
      if(!coordinator&&task.assignee_id!==user.id&&!await database.prepare("SELECT 1 FROM task_assignees WHERE task_id=? AND user_id=?").bind(taskId,user.id).first())return fail("Acceso denegado",403);
      const start=date(body.actualStart),end=date(body.actualEnd);
      if(!validRange(start,end))return fail("La fecha final real debe ser posterior al inicio");
      const progress=Number(body.progress);
      if(!Number.isInteger(progress)||progress<0||progress>100)return fail("El avance debe estar entre 0 y 100");
      await database.prepare("UPDATE tasks SET status=?,actual_start=?,actual_end=?,progress=? WHERE id=?")
        .bind(status,start,end,status==="done"?100:progress,taskId).run();
    } else return fail("Operación no reconocida");
    return Response.json({ok:true});
  } catch(error) {
    console.error(error);
    return fail(error instanceof Error&&/UNIQUE constraint failed/.test(error.message)?"Ese dato ya está registrado":"No se pudo guardar el cambio",500);
  }
}
