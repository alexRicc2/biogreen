import { useCallback, useEffect, useRef, useState } from 'react';
import type { BiogreenProject, EvaluationState, ProjectUiState } from '../types/biogreen';
import {
  createBlankProject,
  duplicateProject as cloneProject,
  isActiveProject,
  nowIso,
  projectFromEvaluation,
  projectToEvaluation,
  restoreProject,
  softDeleteProject,
  sortProjectsRecent,
  uniqueUntitledTitle,
} from '../utils/projectStore';
import {
  deleteProjectHard,
  getAllProjects,
  loadWorkspaceFromDb,
  putProject,
  putProjects,
  setActiveProjectId,
} from '../utils/projectDb';

const SAVE_DEBOUNCE_MS = 400;
const UNDO_MS = 12_000;
const CHANNEL = 'biogreen-workspace';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string };

export type UndoToast =
  | { kind: 'delete'; project: BiogreenProject }
  | { kind: 'reset'; project: BiogreenProject }
  | null;

type TabMessage =
  | { type: 'projects-changed'; source: string; activeProjectId: string }
  | { type: 'ping' };

function tabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tab_${Math.random().toString(36).slice(2)}`;
}

export function useWorkspace() {
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<BiogreenProject[]>([]);
  const [activeProjectId, setActiveId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [undoToast, setUndoToast] = useState<UndoToast>(null);
  const [foreignChange, setForeignChange] = useState(false);

  const projectsRef = useRef(projects);
  const activeIdRef = useRef(activeProjectId);
  const pendingRef = useRef<BiogreenProject | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfTabId = useRef(tabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const skipBroadcastRef = useRef(false);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    activeIdRef.current = activeProjectId;
  }, [activeProjectId]);

  const broadcast = useCallback((msg: TabMessage) => {
    if (skipBroadcastRef.current) return;
    try {
      channelRef.current?.postMessage({ ...msg, source: selfTabId.current });
    } catch {
      // ignore
    }
  }, []);

  const persistNow = useCallback(
    async (project: BiogreenProject, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setSaveStatus({ kind: 'saving' });
      try {
        await putProject(project);
        await setActiveProjectId(activeIdRef.current || project.id);
        pendingRef.current = null;
        if (!opts?.silent) setSaveStatus({ kind: 'saved', at: new Date() });
        broadcast({
          type: 'projects-changed',
          source: selfTabId.current,
          activeProjectId: activeIdRef.current || project.id,
        });
      } catch (err) {
        setSaveStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Save failed',
        });
      }
    },
    [broadcast],
  );

  const flushPending = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending) {
      await persistNow(pending);
    }
  }, [persistNow]);

  const scheduleSave = useCallback(
    (project: BiogreenProject) => {
      pendingRef.current = project;
      setSaveStatus({ kind: 'saving' });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void persistNow(project);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistNow],
  );

  const replaceProjects = useCallback((next: BiogreenProject[], activeId: string) => {
    setProjects(next);
    setActiveId(activeId);
    projectsRef.current = next;
    activeIdRef.current = activeId;
  }, []);

  const reloadFromDb = useCallback(async () => {
    const loaded = await loadWorkspaceFromDb();
    replaceProjects(loaded.projects, loaded.activeProjectId);
    setForeignChange(false);
    setSaveStatus({ kind: 'saved', at: new Date() });
  }, [replaceProjects]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadWorkspaceFromDb();
        if (cancelled) return;
        replaceProjects(loaded.projects, loaded.activeProjectId);
        setSaveStatus({ kind: 'saved', at: new Date() });
      } catch {
        if (cancelled) return;
        const blank = createBlankProject();
        replaceProjects([blank], blank.id);
        try {
          await putProject(blank);
          await setActiveProjectId(blank.id);
        } catch {
          // memory-only fallback
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [replaceProjects]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<TabMessage & { source?: string }>) => {
      const data = ev.data;
      if (!data || data.source === selfTabId.current) return;
      if (data.type === 'projects-changed') {
        setForeignChange(true);
      }
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      // Best-effort sync flush via keepalive is not available for IDB;
      // clear debounce and fire put (may complete in modern browsers).
      if (timerRef.current) clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      if (pending) {
        void putProject(pending);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const activeProject =
    projects.find((p) => p.id === activeProjectId && isActiveProject(p)) ??
    projects.find(isActiveProject) ??
    null;

  const activeProjects = sortProjectsRecent(projects.filter(isActiveProject));

  const patchActive = useCallback(
    (updater: (prev: BiogreenProject) => BiogreenProject) => {
      const current =
        projectsRef.current.find((p) => p.id === activeIdRef.current) ??
        projectsRef.current.find(isActiveProject);
      if (!current || current.deletedAt) return;
      const next = {
        ...updater(current),
        updatedAt: nowIso(),
        id: current.id,
        createdAt: current.createdAt,
      };
      setProjects((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const setEvaluation = useCallback(
    (next: EvaluationState | ((prev: EvaluationState) => EvaluationState)) => {
      patchActive((project) => {
        const prevEval = projectToEvaluation(project);
        const evaluation = typeof next === 'function' ? next(prevEval) : next;
        return {
          ...project,
          title: evaluation.projectTitle,
          routeA: evaluation.proposed,
          routeB: evaluation.baseline,
        };
      });
    },
    [patchActive],
  );

  const commitTitle = useCallback(
    (title: string) => {
      patchActive((project) => ({
        ...project,
        title: title.trim() || 'Untitled BIOGREEN Evaluation',
      }));
    },
    [patchActive],
  );

  const setUi = useCallback(
    (partial: Partial<ProjectUiState>) => {
      patchActive((project) => ({
        ...project,
        ui: { ...project.ui, ...partial },
      }));
    },
    [patchActive],
  );

  const switchProject = useCallback(
    async (projectId: string) => {
      if (projectId === activeIdRef.current) return;
      await flushPending();
      // Persist current UI scroll before leaving
      const current = projectsRef.current.find((p) => p.id === activeIdRef.current);
      if (current && !current.deletedAt) {
        const withScroll: BiogreenProject = {
          ...current,
          ui: { ...current.ui, scrollY: window.scrollY },
          updatedAt: nowIso(),
        };
        setProjects((prev) => prev.map((p) => (p.id === withScroll.id ? withScroll : p)));
        await putProject(withScroll);
      }
      await setActiveProjectId(projectId);
      setActiveId(projectId);
      activeIdRef.current = projectId;
      broadcast({
        type: 'projects-changed',
        source: selfTabId.current,
        activeProjectId: projectId,
      });
      const next = projectsRef.current.find((p) => p.id === projectId);
      if (next?.ui.scrollY) {
        requestAnimationFrame(() => window.scrollTo(0, next.ui.scrollY));
      } else {
        requestAnimationFrame(() => window.scrollTo(0, 0));
      }
    },
    [broadcast, flushPending],
  );

  const createNewProject = useCallback(async () => {
    await flushPending();
    const title = uniqueUntitledTitle(projectsRef.current);
    const project = createBlankProject(title);
    setProjects((prev) => [...prev, project]);
    setActiveId(project.id);
    activeIdRef.current = project.id;
    await putProject(project);
    await setActiveProjectId(project.id);
    setSaveStatus({ kind: 'saved', at: new Date() });
    broadcast({
      type: 'projects-changed',
      source: selfTabId.current,
      activeProjectId: project.id,
    });
    window.scrollTo(0, 0);
    return project;
  }, [broadcast, flushPending]);

  const createFromTemplate = useCallback(
    async (evaluation: EvaluationState, title?: string) => {
      await flushPending();
      const project = projectFromEvaluation({
        ...evaluation,
        projectTitle:
          title?.trim() ||
          evaluation.projectTitle.trim() ||
          uniqueUntitledTitle(projectsRef.current),
      });
      setProjects((prev) => [...prev, project]);
      setActiveId(project.id);
      activeIdRef.current = project.id;
      await putProject(project);
      await setActiveProjectId(project.id);
      setSaveStatus({ kind: 'saved', at: new Date() });
      broadcast({
        type: 'projects-changed',
        source: selfTabId.current,
        activeProjectId: project.id,
      });
      window.scrollTo(0, 0);
      return project;
    },
    [broadcast, flushPending],
  );

  const duplicateActive = useCallback(async () => {
    const current = projectsRef.current.find((p) => p.id === activeIdRef.current);
    if (!current || current.deletedAt) return;
    await flushPending();
    const copy = cloneProject(current);
    setProjects((prev) => [...prev, copy]);
    setActiveId(copy.id);
    activeIdRef.current = copy.id;
    await putProject(copy);
    await setActiveProjectId(copy.id);
    setSaveStatus({ kind: 'saved', at: new Date() });
    broadcast({
      type: 'projects-changed',
      source: selfTabId.current,
      activeProjectId: copy.id,
    });
  }, [broadcast, flushPending]);

  const queueUndoToast = useCallback((toast: UndoToast) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(toast);
    if (toast) {
      undoTimerRef.current = setTimeout(() => setUndoToast(null), UNDO_MS);
    }
  }, []);

  const softDeleteActive = useCallback(async () => {
    const current = projectsRef.current.find((p) => p.id === activeIdRef.current);
    if (!current || current.deletedAt) return;
    await flushPending();
    const deleted = softDeleteProject(current);
    queueUndoToast({ kind: 'delete', project: structuredClone(current) });

    let nextProjects = projectsRef.current.map((p) =>
      p.id === deleted.id ? deleted : p,
    );
    const remaining = nextProjects.filter(isActiveProject);
    let nextActive = activeIdRef.current;
    if (remaining.length === 0) {
      const blank = createBlankProject();
      nextProjects = [...nextProjects, blank];
      nextActive = blank.id;
      await putProject(blank);
    } else {
      nextActive = sortProjectsRecent(remaining)[0].id;
    }
    await putProject(deleted);
    await setActiveProjectId(nextActive);
    replaceProjects(nextProjects, nextActive);
    setSaveStatus({ kind: 'saved', at: new Date() });
    broadcast({
      type: 'projects-changed',
      source: selfTabId.current,
      activeProjectId: nextActive,
    });
  }, [broadcast, flushPending, queueUndoToast, replaceProjects]);

  const resetActive = useCallback(async () => {
    const current = projectsRef.current.find((p) => p.id === activeIdRef.current);
    if (!current || current.deletedAt) return;
    const ok = window.confirm(
      `Reset “${current.title}”? All answers on Route A and Route B will be cleared. You can undo for a few seconds.`,
    );
    if (!ok) return;
    await flushPending();
    queueUndoToast({ kind: 'reset', project: structuredClone(current) });
    const blank = createBlankProject(current.title);
    const reset: BiogreenProject = {
      ...blank,
      id: current.id,
      createdAt: current.createdAt,
      title: current.title,
      ui: { ...current.ui, activeRoute: 'proposed' },
    };
    setProjects((prev) => prev.map((p) => (p.id === reset.id ? reset : p)));
    await putProject(reset);
    setSaveStatus({ kind: 'saved', at: new Date() });
    broadcast({
      type: 'projects-changed',
      source: selfTabId.current,
      activeProjectId: reset.id,
    });
  }, [broadcast, flushPending, queueUndoToast]);

  const undoLast = useCallback(async () => {
    if (!undoToast) return;
    const snapshot = undoToast.project;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    await flushPending();
    const restored = restoreProject(snapshot);
    const exists = projectsRef.current.some((p) => p.id === restored.id);
    const nextProjects = exists
      ? projectsRef.current.map((p) => (p.id === restored.id ? restored : p))
      : [...projectsRef.current, restored];
    await putProject(restored);
    await setActiveProjectId(restored.id);
    replaceProjects(nextProjects, restored.id);
    setSaveStatus({ kind: 'saved', at: new Date() });
    broadcast({
      type: 'projects-changed',
      source: selfTabId.current,
      activeProjectId: restored.id,
    });
  }, [broadcast, flushPending, replaceProjects, undoToast]);

  const importProjects = useCallback(
    async (incoming: BiogreenProject[], makeActiveId?: string) => {
      await flushPending();
      const migrated = incoming
        .map((p) => ({ ...p, deletedAt: p.deletedAt ?? null }))
        .filter((p) => p.id);
      await putProjects(migrated);
      const all = await getAllProjects();
      const active =
        (makeActiveId && all.find((p) => p.id === makeActiveId && isActiveProject(p))?.id) ||
        sortProjectsRecent(all.filter(isActiveProject))[0]?.id;
      if (!active) {
        const blank = createBlankProject();
        await putProject(blank);
        await setActiveProjectId(blank.id);
        replaceProjects([blank], blank.id);
      } else {
        await setActiveProjectId(active);
        replaceProjects(all, active);
      }
      setSaveStatus({ kind: 'saved', at: new Date() });
      broadcast({
        type: 'projects-changed',
        source: selfTabId.current,
        activeProjectId: activeIdRef.current,
      });
    },
    [broadcast, flushPending, replaceProjects],
  );

  // Hard-delete trash entries older than retention is handled in loadWorkspaceFromDb.
  // Also allow explicit purge of a soft-deleted id after undo window ends (optional).
  void deleteProjectHard;

  return {
    ready,
    projects,
    activeProjects,
    activeProject,
    activeProjectId,
    evaluation: activeProject ? projectToEvaluation(activeProject) : null,
    ui: activeProject?.ui ?? null,
    saveStatus,
    undoToast,
    foreignChange,
    setEvaluation,
    commitTitle,
    setUi,
    switchProject,
    createNewProject,
    createFromTemplate,
    duplicateActive,
    softDeleteActive,
    resetActive,
    undoLast,
    flushPending,
    reloadFromDb,
    importProjects,
    dismissForeignChange: () => setForeignChange(false),
  };
}
