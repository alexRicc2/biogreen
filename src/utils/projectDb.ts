import type { BiogreenProject, WorkspaceMeta } from '../types/biogreen';
import {
  LEGACY_LOCALSTORAGE_KEY,
  createBlankProject,
  isTrashExpired,
  migrateProject,
  parseLegacyWorkspace,
} from './projectStore';

const DB_NAME = 'biogreen';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_META = 'meta';
const META_KEY = 'workspace';

type IDBReq<T> = IDBRequest<T>;

function reqToPromise<T>(req: IDBReq<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const resultOrReq = fn(store);
    const result =
      resultOrReq instanceof IDBRequest
        ? await reqToPromise(resultOrReq)
        : await resultOrReq;
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function putProject(project: BiogreenProject): Promise<void> {
  await withStore(STORE_PROJECTS, 'readwrite', (store) => store.put(project));
}

export async function putProjects(projects: BiogreenProject[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    for (const p of projects) store.put(p);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to put projects'));
    });
  } finally {
    db.close();
  }
}

export async function getProject(id: string): Promise<BiogreenProject | null> {
  const raw = await withStore<BiogreenProject | undefined>(
    STORE_PROJECTS,
    'readonly',
    (store) => store.get(id),
  );
  return raw ? migrateProject(raw) : null;
}

export async function getAllProjects(): Promise<BiogreenProject[]> {
  const raw = await withStore<BiogreenProject[]>(
    STORE_PROJECTS,
    'readonly',
    (store) => store.getAll(),
  );
  return (raw ?? [])
    .map(migrateProject)
    .filter((p): p is BiogreenProject => p !== null);
}

export async function deleteProjectHard(id: string): Promise<void> {
  await withStore(STORE_PROJECTS, 'readwrite', (store) => store.delete(id));
}

export async function getMeta(): Promise<WorkspaceMeta | null> {
  const row = await withStore<{ key: string; activeProjectId: string } | undefined>(
    STORE_META,
    'readonly',
    (store) => store.get(META_KEY),
  );
  if (!row || typeof row.activeProjectId !== 'string') return null;
  return { activeProjectId: row.activeProjectId };
}

export async function setActiveProjectId(activeProjectId: string): Promise<void> {
  await withStore(STORE_META, 'readwrite', (store) =>
    store.put({ key: META_KEY, activeProjectId }),
  );
}

export async function purgeExpiredTrash(): Promise<void> {
  const all = await getAllProjects();
  const expired = all.filter(isTrashExpired);
  if (expired.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    for (const p of expired) store.delete(p.id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to purge trash'));
    });
  } finally {
    db.close();
  }
}

/**
 * Load workspace from IndexedDB, migrating legacy localStorage once if needed.
 * Always returns at least one active blank project.
 */
export async function loadWorkspaceFromDb(): Promise<{
  projects: BiogreenProject[];
  activeProjectId: string;
}> {
  let projects = await getAllProjects();
  let meta = await getMeta();

  if (projects.length === 0 && typeof localStorage !== 'undefined') {
    const legacy = parseLegacyWorkspace(localStorage.getItem(LEGACY_LOCALSTORAGE_KEY));
    if (legacy) {
      await putProjects(legacy.projects);
      if (legacy.activeProjectId) await setActiveProjectId(legacy.activeProjectId);
      try {
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      } catch {
        // ignore
      }
      projects = legacy.projects;
      meta = legacy.activeProjectId
        ? { activeProjectId: legacy.activeProjectId }
        : null;
    }
  }

  await purgeExpiredTrash();
  projects = await getAllProjects();

  const active = projects.filter((p) => !p.deletedAt);
  if (active.length === 0) {
    const blank = createBlankProject();
    await putProject(blank);
    await setActiveProjectId(blank.id);
    return { projects: [blank], activeProjectId: blank.id };
  }

  const activeProjectId =
    meta && active.some((p) => p.id === meta.activeProjectId)
      ? meta.activeProjectId
      : active.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].id;

  if (!meta || meta.activeProjectId !== activeProjectId) {
    await setActiveProjectId(activeProjectId);
  }

  return { projects, activeProjectId };
}
