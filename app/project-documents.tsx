"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, UploadCloud } from "lucide-react";

type Document = { id: string; file_name: string; mime_type: string; size_bytes: number; uploaded_by_name: string | null; created_at: string };
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const result = await response.json() as { documents?: Document[]; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudieron cargar los documentos");
      setDocuments(result.documents || []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Error de carga"); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} supera el límite de 20 MB`);
        const body = new FormData();
        body.set("projectId", projectId);
        body.set("file", file);
        const response = await fetch("/api/documents", { method: "POST", body });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || `No se pudo subir ${file.name}`);
      }
      await load();
    } catch (cause) { await load(); setError(cause instanceof Error ? cause.message : "No se pudieron subir los documentos"); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  };

  return <div className="max-w-5xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-[#173d60]">Documentos del proyecto</h2><p className="mt-1 text-xs text-[#7896ac]">Archivos compartidos con las personas que tienen acceso a este proyecto.</p></div><div><input ref={input} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.png,.jpg,.jpeg" className="sr-only" onChange={event => void upload(event.target.files)}/><button className="primary-btn" disabled={uploading} onClick={() => input.current?.click()}><UploadCloud size={17}/>{uploading ? "Subiendo…" : "Subir documentos"}</button></div></div>
    <p className="mb-4 text-xs text-[#8ba5b8]">PDF, Office, texto e imágenes · máximo 20 MB por archivo</p>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</p>}
    {loading ? <p className="py-8 text-sm text-[#8ba5b8]">Cargando documentos…</p> : documents.length ? <div className="overflow-hidden rounded-2xl border border-[#dce8f1] bg-white">{documents.map(doc => <div key={doc.id} className="flex items-center gap-4 border-b border-[#edf3f8] px-5 py-4 last:border-0"><span className="rounded-xl bg-[#e8f3fb] p-3 text-[#347ba9]"><FileText size={20}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#214968]" title={doc.file_name}>{doc.file_name}</p><p className="mt-1 text-[11px] text-[#8ba5b8]">{fileSize(doc.size_bytes)} · {doc.uploaded_by_name || "Integrante"} · {new Date(doc.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</p></div><a className="secondary-btn shrink-0 px-3 py-2" href={`/api/documents?download=${encodeURIComponent(doc.id)}`} aria-label={`Descargar ${doc.file_name}`} title="Descargar"><Download size={16}/><span className="hidden sm:inline">Descargar</span></a></div>)}</div> : <div className="rounded-2xl border border-dashed border-[#cddfec] bg-white px-6 py-12 text-center text-sm text-[#91a9ba]"><FileText className="mx-auto mb-3 text-[#b6d0e2]" size={28}/>Todavía no hay documentos en este proyecto.</div>}
  </div>;
}
