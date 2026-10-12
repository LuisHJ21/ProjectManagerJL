"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo iniciar sesión");
      window.location.replace("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión"); setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#f2f7fc] p-6"><div className="w-full max-w-md rounded-3xl border border-[#dce8f1] bg-white p-8 shadow-xl shadow-[#1d608e]/10 sm:p-10"><div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#18547d] text-2xl font-bold text-white">N</div><p className="text-center text-[11px] font-bold uppercase tracking-[.2em] text-[#408ebd]">Nexo · Gestión de proyectos</p><h1 className="mt-2 text-center text-2xl font-bold text-[#173d60]">Accede a tu espacio de trabajo</h1><p className="mt-2 text-center text-sm text-[#7896ac]">Consulta tus proyectos y actividades asignadas.</p><form onSubmit={submit} className="mt-8 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#3f617b]">Usuario</span><input className="field" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)}/></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#3f617b]">Contraseña</span><input className="field" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</p>}<button className="primary-btn w-full" disabled={busy}><LogIn size={16}/>{busy ? "Ingresando…" : "Ingresar"}</button></form></div></main>;
}
