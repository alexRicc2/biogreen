import type {
  BiogreenProject,
  EvaluationState,
  ProjectUiState,
  RouteState,
} from '../types/biogreen';
import {
  BIOGREEN_RUBRIC_VERSION,
  PROJECT_SCHEMA_VERSION,
} from '../types/biogreen';
import { createEmptyEvaluation, createEmptyRoute } from '../data/criteriaConfig';
import { countEvaluated } from './calculator';

/** Soft-deleted projects are purged after this window. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const LEGACY_LOCALSTORAGE_KEY = 'biogreen.workspace.v1';

export function nowIso(): string {
  return new Date().toISOString();
}

export function createProjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultUiState(): ProjectUiState {
  return {
    activeRoute: 'proposed',
    openAxes: { A: true, B: true, C: true },
    sideBySideOpen: true,
    scrollY: 0,
  };
}

export function createBlankProject(title?: string): BiogreenProject {
  const empty = createEmptyEvaluation();
  const stamp = nowIso();
  return {
    id: createProjectId(),
    title: title?.trim() || empty.projectTitle,
    createdAt: stamp,
    updatedAt: stamp,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    rubricVersion: BIOGREEN_RUBRIC_VERSION,
    routeA: empty.proposed,
    routeB: empty.baseline,
    ui: defaultUiState(),
    deletedAt: null,
  };
}

export function projectFromEvaluation(
  evaluation: EvaluationState,
  options?: Partial<Pick<BiogreenProject, 'id' | 'createdAt' | 'ui'>>,
): BiogreenProject {
  const stamp = nowIso();
  return {
    id: options?.id ?? createProjectId(),
    title: evaluation.projectTitle.trim() || 'Untitled BIOGREEN Evaluation',
    createdAt: options?.createdAt ?? stamp,
    updatedAt: stamp,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    rubricVersion: BIOGREEN_RUBRIC_VERSION,
    routeA: structuredClone(evaluation.proposed),
    routeB: structuredClone(evaluation.baseline),
    ui: options?.ui ?? defaultUiState(),
    deletedAt: null,
  };
}

/** View adapter for existing UI that still speaks EvaluationState. */
export function projectToEvaluation(project: BiogreenProject): EvaluationState {
  return {
    projectTitle: project.title,
    proposed: project.routeA,
    baseline: project.routeB,
  };
}

export function ensureRouteShape(route: RouteState | undefined, label: string): RouteState {
  if (!route || typeof route !== 'object') return createEmptyRoute(label);
  const base = createEmptyRoute(route.label || label);
  const criteria = { ...base.criteria };
  for (let id = 1; id <= 12; id++) {
    const incoming = route.criteria?.[id] ?? route.criteria?.[String(id) as unknown as number];
    if (incoming && typeof incoming === 'object') {
      criteria[id] = { ...criteria[id], ...structuredClone(incoming) };
    }
  }
  return { label: route.label || label, criteria };
}

/** Migrate any older project shape up to the current schema. */
export function migrateProject(raw: unknown): BiogreenProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;

  // Legacy StoredProject { id, updatedAt, evaluation }
  if (p.evaluation && typeof p.evaluation === 'object') {
    const evaluation = p.evaluation as EvaluationState;
    if (typeof evaluation.projectTitle !== 'string') return null;
    return {
      id: typeof p.id === 'string' ? p.id : createProjectId(),
      title: evaluation.projectTitle,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : (typeof p.updatedAt === 'string' ? p.updatedAt : nowIso()),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso(),
      schemaVersion: PROJECT_SCHEMA_VERSION,
      rubricVersion: BIOGREEN_RUBRIC_VERSION,
      routeA: ensureRouteShape(evaluation.proposed, 'Proposed Synthesis'),
      routeB: ensureRouteShape(evaluation.baseline, 'Baseline Reference'),
      ui: defaultUiState(),
      deletedAt: null,
    };
  }

  if (typeof p.id !== 'string') return null;

  const title =
    typeof p.title === 'string'
      ? p.title
      : 'Untitled BIOGREEN Evaluation';

  const routeA = ensureRouteShape(
    (p.routeA as RouteState | undefined) ??
      ((p as { proposed?: RouteState }).proposed),
    'Proposed Synthesis',
  );
  const routeB = ensureRouteShape(
    (p.routeB as RouteState | undefined) ??
      ((p as { baseline?: RouteState }).baseline),
    'Baseline Reference',
  );

  const uiRaw = (p.ui as Partial<ProjectUiState> | undefined) ?? {};
  const ui: ProjectUiState = {
    ...defaultUiState(),
    ...uiRaw,
    openAxes: {
      A: uiRaw.openAxes?.A ?? true,
      B: uiRaw.openAxes?.B ?? true,
      C: uiRaw.openAxes?.C ?? true,
    },
  };

  return {
    id: p.id,
    title,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : nowIso(),
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso(),
    schemaVersion: PROJECT_SCHEMA_VERSION,
    rubricVersion:
      typeof p.rubricVersion === 'string' ? p.rubricVersion : BIOGREEN_RUBRIC_VERSION,
    routeA,
    routeB,
    ui,
    deletedAt: typeof p.deletedAt === 'string' ? p.deletedAt : null,
  };
}

export function isActiveProject(project: BiogreenProject): boolean {
  return !project.deletedAt;
}

export function uniqueUntitledTitle(existing: BiogreenProject[]): string {
  const base = 'Untitled BIOGREEN Evaluation';
  const titles = new Set(
    existing.filter(isActiveProject).map((p) => p.title.trim()),
  );
  if (!titles.has(base)) return base;
  let n = 2;
  while (titles.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function duplicateProject(source: BiogreenProject): BiogreenProject {
  const stamp = nowIso();
  return {
    ...structuredClone(source),
    id: createProjectId(),
    title: `${source.title.trim() || 'Untitled'} (copy)`,
    createdAt: stamp,
    updatedAt: stamp,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    rubricVersion: BIOGREEN_RUBRIC_VERSION,
    deletedAt: null,
    ui: { ...defaultUiState(), activeRoute: source.ui.activeRoute },
  };
}

export function softDeleteProject(project: BiogreenProject): BiogreenProject {
  return {
    ...project,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function restoreProject(project: BiogreenProject): BiogreenProject {
  return {
    ...project,
    deletedAt: null,
    updatedAt: nowIso(),
  };
}

export function isTrashExpired(project: BiogreenProject, now = Date.now()): boolean {
  if (!project.deletedAt) return false;
  const t = Date.parse(project.deletedAt);
  if (Number.isNaN(t)) return true;
  return now - t > TRASH_RETENTION_MS;
}

export function projectProgress(project: BiogreenProject): {
  routeA: number;
  routeB: number;
} {
  return {
    routeA: countEvaluated(project.routeA),
    routeB: countEvaluated(project.routeB),
  };
}

export function formatProjectOptionLabel(project: BiogreenProject): string {
  const title = project.title.trim() || 'Untitled project';
  const { routeA, routeB } = projectProgress(project);
  const stamp = new Date(project.updatedAt);
  const when = Number.isNaN(stamp.getTime())
    ? ''
    : stamp.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  const progress = `A ${routeA}/12 · B ${routeB}/12`;
  return when ? `${title} — ${progress} — ${when}` : `${title} — ${progress}`;
}

export function sortProjectsRecent(projects: BiogreenProject[]): BiogreenProject[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Parse legacy localStorage workspace blob into projects + active id. */
export function parseLegacyWorkspace(raw: string | null): {
  projects: BiogreenProject[];
  activeProjectId: string | null;
} | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      version?: number;
      activeProjectId?: string;
      projects?: unknown[];
    };
    if (!Array.isArray(data.projects) || data.projects.length === 0) return null;
    const projects = data.projects
      .map(migrateProject)
      .filter((p): p is BiogreenProject => p !== null);
    if (projects.length === 0) return null;
    const activeProjectId =
      typeof data.activeProjectId === 'string' &&
      projects.some((p) => p.id === data.activeProjectId)
        ? data.activeProjectId
        : projects[0].id;
    return { projects, activeProjectId };
  } catch {
    return null;
  }
}
