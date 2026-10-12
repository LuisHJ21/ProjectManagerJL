import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/50">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#172c46] text-2xl font-bold text-white">N</div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-[#e5815b]">Gestión de proyectos</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#172c46]">Todo tu trabajo, conectado.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">Organiza proyectos, coordina a tu equipo y sigue cada entrega en un solo espacio.</p>
        <a className="mt-9 block rounded-xl bg-[#172c46] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#24476e]" href={chatGPTSignInPath("/")} target="_top">Ingresar con ChatGPT</a>
        <p className="mt-5 text-xs text-slate-400">Acceso protegido para tu equipo</p>
      </div>
    </main>
  );
  return <Dashboard />;
}
