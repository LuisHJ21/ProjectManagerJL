"use client";

import { CalendarRange } from "lucide-react";

type TimelineTask = { id: string; title: string; kind: string; progress: number; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null; stage_id: string | null };
type Stage = { id: string; name: string };
const dayMs = 86_400_000;
const epoch = (date: string) => Date.parse(`${date}T00:00:00Z`);
const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("es-PE", { day: "numeric", month: "short", timeZone: "UTC" });
const day = (time: number) => new Date(time).toISOString().slice(0, 10);

export function ProjectTimeline({ tasks, stages }: { tasks: TimelineTask[]; stages: Stage[] }) {
  const scheduled = tasks.filter(task => task.planned_start && task.planned_end).sort((a, b) => a.planned_start!.localeCompare(b.planned_start!));
  if (!scheduled.length) return <div className="rounded-2xl border border-dashed border-[#cddfec] bg-white px-6 py-12 text-center text-sm text-[#91a9ba]"><CalendarRange className="mx-auto mb-3 text-[#b6d0e2]" size={27}/>Aún no hay actividades con fechas planificadas.</div>;

  const dates = scheduled.flatMap(task => [task.planned_start, task.planned_end, task.actual_start, task.actual_end].filter((value): value is string => !!value)).map(epoch);
  const start = Math.min(...dates) - dayMs;
  const end = Math.max(...dates) + dayMs;
  const days = Math.max(1, Math.round((end - start) / dayMs));
  const chartWidth = Math.min(3600, Math.max(760, days * 18));
  const ticks = Array.from({ length: 11 }, (_, index) => start + (end - start) * index / 10);
  const today = epoch(new Date().toISOString().slice(0, 10));
  const pos = (date: string) => Math.max(0, Math.min(100, (epoch(date) - start) / (end - start) * 100));
  const span = (from: string, to: string) => Math.max(0.5, (epoch(to) - epoch(from) + dayMs) / (end - start) * 100);

  return <div className="overflow-x-auto rounded-2xl border border-[#dce8f1] bg-white shadow-sm" aria-label="Línea de tiempo del proyecto">
    <div style={{ width: chartWidth + 250 }}>
      <div className="flex border-b border-[#dce8f1] bg-[#f4f9fd]"><div className="sticky left-0 z-20 w-[250px] shrink-0 border-r border-[#dce8f1] bg-[#f4f9fd] px-5 py-4 text-xs font-bold text-[#315f81]">Actividad</div><div className="relative h-12" style={{ width: chartWidth }}>{ticks.map((tick, index) => <span key={index} className="absolute top-4 -translate-x-1/2 text-[10px] font-semibold text-[#7291a7]" style={{ left: `${index * 10}%` }}>{label(day(tick))}</span>)}</div></div>
      {scheduled.map(task => {
        const stage = stages.find(item => item.id === task.stage_id)?.name;
        const actualEnd = task.actual_end || (task.actual_start ? new Date().toISOString().slice(0, 10) : null);
        return <div key={task.id} className="flex border-b border-[#edf3f8] last:border-0">
          <div className="sticky left-0 z-10 flex w-[250px] shrink-0 items-center border-r border-[#edf3f8] bg-white px-5 py-3"><div className="min-w-0"><strong className="block truncate text-xs text-[#214968]" title={task.title}>{task.title}</strong><span className="text-[10px] text-[#8ca6b9]">{stage?`${stage} · `:""}{task.progress}% completado</span></div></div>
          <div className="relative h-[66px]" style={{ width: chartWidth, backgroundImage: "linear-gradient(to right, #e9f0f6 1px, transparent 1px)", backgroundSize: `${chartWidth / 10}px 100%` }}>
            {today >= start && today <= end && <div className="absolute inset-y-0 z-10 border-l-2 border-dashed border-[#e19c55]" style={{ left: `${(today - start) / (end - start) * 100}%` }} title="Hoy"/>}
            {task.kind === "milestone" ? <div className="absolute top-[20px] h-3.5 w-3.5 rotate-45 bg-[#367fb5]" style={{ left: `${pos(task.planned_start!)}%` }} title={`Hito planificado: ${label(task.planned_start!)}`}/> : <div className="absolute top-[16px] h-3 rounded-full bg-[#3d86ba]" style={{ left: `${pos(task.planned_start!)}%`, width: `${span(task.planned_start!, task.planned_end!)}%` }} title={`Planificado: ${label(task.planned_start!)} – ${label(task.planned_end!)}`}/>}
            {task.actual_start && actualEnd && <div className="absolute top-[39px] h-2.5 rounded-full bg-[#40b6ad]" style={{ left: `${pos(task.actual_start)}%`, width: `${span(task.actual_start, actualEnd)}%` }} title={`Real: ${label(task.actual_start)} – ${task.actual_end ? label(task.actual_end) : "hoy"}`}/>}
          </div>
        </div>;
      })}
      <div className="flex gap-5 border-t border-[#dce8f1] bg-[#fbfdff] px-5 py-3 text-[11px] text-[#6e8ca3]"><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded bg-[#3d86ba]"/>Planificado</span><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded bg-[#40b6ad]"/>Real</span><span><i className="mr-1.5 inline-block h-3 border-l-2 border-dashed border-[#e19c55]"/>Hoy</span></div>
    </div>
  </div>;
}
