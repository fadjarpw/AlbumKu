"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVE_PROJECT_KEY, exportProject, importProject, listProjects, loadProject, newProjectId, saveProject } from "./projects";
import type { Project, ProjectSummary, StoredPhoto } from "./projects";

export function useProjects<S>(snapshot: { photos: StoredPhoto[]; settings: S }, apply: (project: Project<S>) => void) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("Proyek pertama");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [status, setStatus] = useState("Membuka proyek…");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ snapshot: typeof snapshot; id: string; name: string } | null>(null);
  const current = useRef({ snapshot, apply, id, name });
  useEffect(() => { current.current = { snapshot, apply, id, name }; });
  const pending = useRef(false);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const initialized = useRef(false);

  const persist = useCallback(async () => {
    const value = current.current;
    if (!value.id) return;
    const project = { ...value.snapshot, id: value.id, name: value.name, updatedAt: Date.now() };
    pending.current = true;
    setStatus("Menyimpan…");
    const operation = saving.current.catch(() => undefined).then(() => saveProject(project));
    saving.current = operation;
    try {
      await operation;
      if (saving.current === operation) {
        const latest = current.current;
        pending.current = latest.snapshot !== value.snapshot || latest.id !== value.id || latest.name !== value.name;
        setSaved(value); setStatus("Tersimpan otomatis"); setError("");
      }
      setProjects(await listProjects());
    } catch {
      setStatus("Belum tersimpan");
      setError("Penyimpanan browser gagal/penuh. Unduh cadangan proyek agar pekerjaan tetap aman.");
      throw new Error("Proyek belum tersimpan. Unduh cadangan dahulu.");
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const active = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const saved = active ? await loadProject<S>(active) : undefined;
        if (saved) {
          current.current.apply(saved); setId(saved.id); setName(saved.name);
        } else {
          const nextId = newProjectId(); setId(nextId);
          // Pertahankan pengaturan dari versi sebelum fitur proyek ditambahkan.
          try {
            const legacy = JSON.parse(localStorage.getItem("albumku-pengaturan") ?? "null");
            if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
              current.current.apply({ id: nextId, name: "Proyek pertama", updatedAt: Date.now(), photos: [], settings: { ...current.current.snapshot.settings, ...legacy } });
            }
          } catch { /* Preferensi lama rusak: gunakan pengaturan awal. */ }
          localStorage.setItem(ACTIVE_PROJECT_KEY, nextId);
        }
        setProjects(await listProjects());
        setStatus("Tersimpan otomatis");
      } catch {
        setId(newProjectId());
        setError("Proyek lokal tidak dapat dibuka. Jangan hapus data browser; gunakan cadangan bila ada.");
      } finally { setReady(true); }
    })();
  }, []);

  useEffect(() => {
    if (!ready || busy) return;
    pending.current = true;
    const timer = setTimeout(() => { void persist().catch(() => undefined); }, 350);
    return () => clearTimeout(timer);
  }, [snapshot, id, name, ready, busy, persist]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const saveOnHide = () => { if (document.visibilityState === "hidden" && pending.current) void persist().catch(() => undefined); };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", saveOnHide);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", saveOnHide); };
  }, [persist]);

  async function activate(project: Project<S>) {
    current.current.apply(project);
    setId(project.id); setName(project.name);
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
    setProjects(await listProjects());
  }
  async function open(projectId: string) {
    setBusy(true);
    try { await persist(); const project = await loadProject<S>(projectId); if (project) await activate(project); }
    finally { setBusy(false); }
  }
  async function create(settings: S = current.current.snapshot.settings) {
    setBusy(true);
    try {
      await persist();
      const project = { photos: [], settings, id: newProjectId(), name: "Proyek baru", updatedAt: Date.now() };
      await saveProject(project); await activate(project);
    } finally { setBusy(false); }
  }
  async function backup() {
    const value = current.current;
    return exportProject({ ...value.snapshot, id: value.id, name: value.name, updatedAt: Date.now() });
  }
  async function restore(file: File) {
    const project = await importProject<S>(file);
    // Pastikan seluruh foto dapat dibaca sebelum proyek aktif diganti.
    for (const photo of project.photos) { const bitmap = await createImageBitmap(photo.blob); bitmap.close(); }
    setBusy(true);
    try { await persist(); await saveProject(project); await activate(project); }
    finally { setBusy(false); }
  }
  const dirty = saved?.snapshot !== snapshot || saved?.id !== id || saved?.name !== name;
  return { ready, busy, id, name, setName, projects, status: ready && dirty && !error ? "Menunggu simpan…" : status, error, persist, open, create, backup, restore };
}
