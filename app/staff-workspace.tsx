"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, MessageSquare, Save } from "lucide-react";

type Project = { id: string; name: string; code: string };
type Task = { id: string; project_id: string; title: string; description: string; kind: string; status: string; progress: number; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null };
type Note = { id: string; task_id: string; body: string; author_name: string; created_at: string };
const labels: Record<string, string> = { todo: "Por hacer", progress: "En progreso", review: "En revisión", done: "Completada" };
const formatted = (date: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—";

async function post(operation: string, values: Record<string, unknown>) {
  const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, ...values }) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || "No se pudo guardar");
}

function AssignedTask({ task, notes, onRefresh }: { task: Task; notes: Note[]; onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(task.progress);
  const [actualStart, setActualStart] = useState(task.actual_start || "");
  const [actualEnd, setActualEnd] = useState(task.actual_end || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setStatus(task.status); setProgress(task.progress); setActualStart(task.actual_start || ""); setActualEnd(task.actual_end || ""); }, [task.id, task.status, task.progress, task.actual_start, task.actual_end]);
  const saveProgress = async () => {
    setSaving(true); setError("");
    try { await post("taskProgress", { id: task.id, status, progress: status === "done" ? 100 : progress, actualStart, actualEnd }); await onRefresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el avance"); }
    finally { setSaving(false); }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true); setError("");
    try { await post("taskNote", { taskId: task.id, text: note }); setNote(""); await onRefresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la anotación"); }
    finally { setSaving(false); }
  };
  return <article className="rounded-2xl border border-[#dce8f1] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-base font-bold text-[#173d60]">{task.title}</h3>{task.kind === "milestone" && <span className="rounded bg-[#dceefa] px-1.5 py-0.5 text-[10px] font-bold text-[#3276a5]">HITO</span>}</div>{task.description && <p className="mt-1 text-xs leading-5 text-[#7896ac]">{task.description}</p>}</div><span className="rounded-full bg-[#e8f2fa] px-2.5 py-1 text-[10px] font-semibold text-[#3479a6]">{labels[task.status] || task.status}</span></div><p className="mt-4 flex items-center gap-2 text-xs text-[#7896ac]"><CalendarDays size={14}/>Planificado: {formatted(task.planned_start)} – {formatted(task.planned_end)}</p><div className="mt-5 grid gap-3 sm:grid-cols-[160px_1fr]"><label><span className="mb-1 block text-xs font-semibold text-[#4b6e87]">Estado</span><select className="field" value={status} onChange={event => { const next = event.target.value; setStatus(next); if (next === "done") setProgress(100); }}><option value="todo">Por hacer</option><option value="progress">En progreso</option><option value="review">En revisión</option><option value="done">Completada</option></select></label><label><span className="mb-1 block text-xs font-semibold text-[#4b6e87]">Avance: {status === "done" ? 100 : progress}%</span><input className="mt-3 w-full accent-[#2d7eb4]" type="range" min="0" max="100" step="5" value={status === "done" ? 100 : progress} onChange={event => { const next = Number(event.target.value); setProgress(next); if (status === "todo" && next > 0) setStatus("progress"); }}/></label></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold text-[#4b6e87]">Inicio real</span><input className="field" type="date" value={actualStart} onChange={event => setActualStart(event.target.value)}/></label><label><span className="mb-1 block text-xs font-semibold text-[#4b6e87]">Fin real</span><input className="field" type="date" value={actualEnd} onChange={event => setActualEnd(event.target.value)}/></label></div><div className="mt-4 flex justify-end"><button className="primary-btn" disabled={saving} onClick={saveProgress}><Save size={15}/>{saving ? "Guardando…" : "Guardar avance"}</button></div><div className="mt-5 border-t border-[#e8f0f6] pt-5"><h4 className="flex items-center gap-2 text-xs font-bold text-[#315f81]"><MessageSquare size={15}/>Anotaciones</h4>{notes.length > 0 && <div className="mt-3 max-h-44 space-y-3 overflow-y-auto">{notes.map(item => <div key={item.id} className="border-l-2 border-[#8bbddd] pl-3"><p className="whitespace-pre-wrap text-xs leading-5 text-[#31536e]">{item.body}</p><p className="mt-1 text-[10px] text-[#92aabc]">{item.author_name} · {new Date(item.created_at).toLocaleString("es-PE")}</p></div>)}</div>}<textarea className="field mt-3 min-h-20" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Registra avances, acuerdos o incidencias de esta actividad"/><div className="mt-2 flex justify-end"><button className="secondary-btn" disabled={saving || !note.trim()} onClick={addNote}>Agregar anotación</button></div></div>{error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}</article>;
}

export function StaffWorkspace({ projects, tasks, notes, onRefresh, onOpenProject }: { projects: Project[]; tasks: Task[]; notes: Note[]; onRefresh: () => Promise<void>; onOpenProject: (id: string) => void }) {
  const assignedProjects = projects.filter(project => tasks.some(task => task.project_id === project.id));
  return <div><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#4387b4]">Mi panel</p><h1 className="text-3xl font-bold text-[#133a5c]">Mis actividades</h1><p className="mt-2 text-sm text-[#7896ac]">Actualiza el avance y deja anotaciones en el trabajo que tienes asignado.</p></div><div className="space-y-9">{assignedProjects.map(project => { const own = tasks.filter(task => task.project_id === project.id).sort((a, b) => (a.planned_start || "9999").localeCompare(b.planned_start || "9999")); return <section key={project.id}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold text-[#173d60]">{project.name}</h2><p className="text-xs text-[#8ca5b8]">{project.code} · {own.length} {own.length === 1 ? "actividad asignada" : "actividades asignadas"}</p></div><button className="text-xs font-semibold text-[#2d76a8] hover:underline" onClick={() => onOpenProject(project.id)}>Ver proyecto</button></div><div className="grid gap-4 xl:grid-cols-2">{own.map(task => <AssignedTask key={task.id} task={task} notes={notes.filter(item => item.task_id === task.id)} onRefresh={onRefresh}/>)}</div></section>; })}{!assignedProjects.length && <div className="rounded-2xl border border-dashed border-[#cddfec] bg-white px-6 py-12 text-center text-sm text-[#91a9ba]"><ClipboardList className="mx-auto mb-3 text-[#b6d0e2]" size={28}/>Todavía no tienes actividades asignadas.</div>}</div></div>;
}
