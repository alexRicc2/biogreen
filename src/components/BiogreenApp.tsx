import { useEffect, useRef, useState } from 'react';
import type { CriterionState } from '../types/biogreen';
import { BIOGREEN_RUBRIC_VERSION } from '../types/biogreen';
import {
  AXIS_GROUPS,
  CRITERIA_BY_ID,
  PRESETS,
} from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  countEvaluated,
  countEvaluatedInIds,
  formatScore,
} from '../utils/calculator';
import {
  exportAllProjects,
  exportPdfReport,
  exportPng,
  exportProjectFile,
  exportSvg,
  importBiogreenFile,
} from '../utils/exporters';
import { isTauriRuntime } from '../utils/platform';
import { formatProjectOptionLabel } from '../utils/projectStore';
import { useWorkspace } from '../hooks/useWorkspace';
import BiogreenPictogram from './BiogreenPictogram';
import ComparisonTable from './ComparisonTable';
import CriterionCard from './CriterionCard';
import SideBySideComparison from './SideBySideComparison';

export default function BiogreenApp() {
  const ws = useWorkspace();
  const [presetId, setPresetId] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [showDesktopDownload, setShowDesktopDownload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleSyncedId = useRef<string | null>(null);

  useEffect(() => {
    setShowDesktopDownload(!isTauriRuntime());
  }, []);

  // Sync title draft when switching projects (not on every keystroke save).
  useEffect(() => {
    if (!ws.activeProject) return;
    if (titleSyncedId.current === ws.activeProject.id) return;
    titleSyncedId.current = ws.activeProject.id;
    setTitleDraft(ws.activeProject.title);
    setPresetId('');
  }, [ws.activeProject]);

  if (!ws.ready || !ws.activeProject || !ws.evaluation || !ws.ui) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
        Loading saved projects…
      </div>
    );
  }

  const evaluation = ws.evaluation;
  const activeRoute = ws.ui.activeRoute;
  const openAxes = ws.ui.openAxes;
  const sideBySideOpen = ws.ui.sideBySideOpen;

  const proposedResult = computeGlobalScore(evaluation.proposed);
  const baselineResult = computeGlobalScore(evaluation.baseline);
  const delta = computeDeltaS(proposedResult.score, baselineResult.score);

  const activeRouteState =
    activeRoute === 'proposed' ? evaluation.proposed : evaluation.baseline;
  const evaluatedCount = countEvaluated(activeRouteState);
  const proposedCount = countEvaluated(evaluation.proposed);
  const baselineCount = countEvaluated(evaluation.baseline);
  const activeResult = activeRoute === 'proposed' ? proposedResult : baselineResult;
  const route = activeRouteState;
  const baselineReady = baselineResult.score !== null;
  const allAxesOpen = AXIS_GROUPS.every((g) => openAxes[g.axis]);

  const axisProgress = AXIS_GROUPS.map((g) => ({
    axis: g.axis,
    label: g.label,
    done: countEvaluatedInIds(route, g.ids),
    total: g.ids.length,
  }));

  const exportCtx = {
    route: activeRoute === 'proposed' ? evaluation.proposed : evaluation.baseline,
    otherRoute: activeRoute === 'proposed' ? evaluation.baseline : evaluation.proposed,
    routeTitle:
      activeRoute === 'proposed'
        ? `Route A — Proposed · ${evaluation.projectTitle}`
        : `Route B — Baseline · ${evaluation.projectTitle}`,
  };

  const setActiveRoute = (next: 'proposed' | 'baseline') => {
    ws.setUi({ activeRoute: next });
  };

  const setOpenAxes = (next: typeof openAxes) => {
    ws.setUi({ openAxes: next });
  };

  const setAllAxes = (open: boolean) => {
    ws.setUi({ openAxes: { A: open, B: open, C: open } });
  };

  const updateCriterion = (id: number, next: CriterionState) => {
    ws.setEvaluation((prev) => {
      const key = activeRoute === 'proposed' ? 'proposed' : 'baseline';
      return {
        ...prev,
        [key]: {
          ...prev[key],
          criteria: { ...prev[key].criteria, [id]: next },
        },
      };
    });
  };

  const copyProposedToBaseline = () => {
    const baselineHasData = countEvaluated(evaluation.baseline) > 0;
    if (baselineHasData) {
      const ok = window.confirm(
        'Route B (Baseline) already has evaluated criteria. Copying Proposed → Baseline will overwrite those values. Continue?',
      );
      if (!ok) return;
    }
    ws.setEvaluation((prev) => ({
      ...prev,
      baseline: {
        label: prev.baseline.label,
        criteria: structuredClone(prev.proposed.criteria),
      },
    }));
  };

  const commitTitle = () => {
    ws.commitTitle(titleDraft);
    void ws.flushPending();
  };

  const loadTemplate = async (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId('');
    // Templates always create a new project — never overwrite the current one.
    await ws.createFromTemplate(structuredClone(preset.evaluation), preset.evaluation.projectTitle);
    titleSyncedId.current = null;
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = importBiogreenFile(text);
      if (parsed.kind === 'backup') {
        const ok = window.confirm(
          `Import backup with ${parsed.projects.length} project(s)? Existing projects with the same IDs will be replaced.`,
        );
        if (!ok) return;
        await ws.importProjects(parsed.projects, parsed.activeProjectId ?? undefined);
      } else {
        await ws.importProjects([parsed.project], parsed.project.id);
      }
      titleSyncedId.current = null;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to import file');
    }
  };

  const saveStatusLabel = (() => {
    if (ws.saveStatus.kind === 'saving') return 'Saving…';
    if (ws.saveStatus.kind === 'error') return `Save failed`;
    if (ws.saveStatus.kind === 'saved') {
      return `Saved ${ws.saveStatus.at.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return 'Autosave ready';
  })();

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-[#F8FAFC] text-slate-900">
      {ws.foreignChange && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-950 sm:px-6">
          This project changed in another tab.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void ws.reloadFromDb()}
          >
            Reload
          </button>{' '}
          to avoid overwriting, or{' '}
          <button
            type="button"
            className="underline"
            onClick={() => ws.dismissForeignChange()}
          >
            dismiss
          </button>
          .
        </div>
      )}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] min-w-0 flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 sm:text-[11px] sm:tracking-[0.14em]">
              Circular Bioeconomy Material Metric
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              BIOGREEN
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Rubric v{BIOGREEN_RUBRIC_VERSION}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex min-w-0 w-full items-center gap-2 text-sm sm:w-auto">
              <span className="shrink-0 text-slate-600">Template</span>
              <select
                className="min-w-0 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400 sm:max-w-[280px]"
                value={presetId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  void loadTemplate(id);
                }}
              >
                <option value="">Create from template…</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void ws.resetActive()}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset project
              </button>
              {showDesktopDownload && (
                <a
                  href="/download"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span className="sm:hidden">Desktop App</span>
                  <span className="hidden sm:inline">Download Desktop App</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] min-w-0 space-y-6 px-3 py-6 sm:px-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <section className="min-w-0 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Saved projects
                  </span>
                  <select
                    className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    value={ws.activeProjectId}
                    onChange={(e) => void ws.switchProject(e.target.value)}
                  >
                    {ws.activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatProjectOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      titleSyncedId.current = null;
                      void ws.createNewProject();
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      titleSyncedId.current = null;
                      void ws.duplicateActive();
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const title = ws.activeProject?.title.trim() || 'this project';
                      const ok = window.confirm(
                        `Delete “${title}”? It will stay in trash for 30 days — use Undo right after if needed.`,
                      );
                      if (ok) void ws.softDeleteActive();
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <label className="mb-1 block min-w-0">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Project title
                </span>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Name this comparison to find it later…"
                />
              </label>
              <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                <span
                  className={
                    ws.saveStatus.kind === 'saving'
                      ? 'font-medium text-slate-800'
                      : ws.saveStatus.kind === 'error'
                        ? 'font-medium text-red-700'
                        : 'font-medium text-emerald-800'
                  }
                >
                  {saveStatusLabel}
                </span>
                <span>· IndexedDB in this browser · scores recomputed on load</span>
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="grid min-w-0 grid-cols-2 rounded-md bg-slate-100 p-1 sm:flex sm:flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveRoute('proposed')}
                    className={`min-w-0 rounded px-2 py-2 text-xs font-semibold transition sm:flex-1 sm:px-3 sm:text-sm ${
                      activeRoute === 'proposed'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block sm:hidden">A · Proposed</span>
                    <span className="hidden sm:inline">
                      Route A: Proposed (S<sub>proposed</sub>)
                    </span>
                    <span
                      className={`mt-0.5 block text-[10px] font-medium ${
                        proposedCount === 12 ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {proposedCount}/12
                      {proposedCount < 12 ? ' incomplete' : ' complete'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRoute('baseline')}
                    className={`min-w-0 rounded px-2 py-2 text-xs font-semibold transition sm:flex-1 sm:px-3 sm:text-sm ${
                      activeRoute === 'baseline'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-300'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block sm:hidden">B · Baseline</span>
                    <span className="hidden sm:inline">
                      Route B: Baseline (S<sub>baseline</sub>)
                    </span>
                    <span
                      className={`mt-0.5 block text-[10px] font-medium ${
                        baselineCount === 12 ? 'text-emerald-700' : 'text-amber-800'
                      }`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {baselineCount}/12
                      {baselineCount === 0
                        ? ' · needed for ΔS'
                        : baselineCount < 12
                          ? ' incomplete'
                          : ' complete'}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copyProposedToBaseline}
                  title="Shortcut: copies Route A inputs into Route B so you only modify what changed"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                >
                  Copy Proposed → Baseline
                </button>
              </div>

              {!baselineReady && (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
                  Fill Route B (Baseline) to compute ΔS — the paper’s mandatory benchmark
                  comparison.
                </p>
              )}
            </div>

            <div className="sticky top-0 z-20 -mx-1 flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC]/95 px-2 py-2 backdrop-blur sm:mx-0">
              <nav className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label="Axis navigation">
                {axisProgress.map((p) => (
                  <a
                    key={p.axis}
                    href={`#axis-${p.axis}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Axis {p.axis}
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] ${
                        p.done === p.total
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {p.done}/{p.total}
                    </span>
                  </a>
                ))}
              </nav>
              <button
                type="button"
                onClick={() => setAllAxes(!allAxesOpen)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {allAxesOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            {AXIS_GROUPS.map((group) => {
              const progress = axisProgress.find((p) => p.axis === group.axis)!;
              return (
                <div
                  key={group.axis}
                  id={`axis-${group.axis}`}
                  className="scroll-mt-16 overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenAxes({ ...openAxes, [group.axis]: !openAxes[group.axis] })
                    }
                    className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
                  >
                    <span className="min-w-0 text-sm font-semibold break-words text-slate-900">
                      {group.label}
                      <span
                        className="ml-2 text-xs font-medium text-slate-600"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {progress.done}/{progress.total}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {openAxes[group.axis] ? '−' : '+'}
                    </span>
                  </button>
                  {openAxes[group.axis] && (
                    <div className="space-y-3 border-t border-slate-100 p-3">
                      {group.ids.map((id) => (
                        <CriterionCard
                          key={`${activeRoute}-${id}`}
                          definition={CRITERIA_BY_ID[id]}
                          state={route.criteria[id]}
                          onChange={(next) => updateCriterion(id, next)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <ComparisonTable evaluation={evaluation} />
          </section>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Live Results & Pictogram</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    evaluatedCount === 12
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {evaluatedCount} / 12 evaluated
                </span>
              </div>

              <div
                className="mb-3 flex flex-wrap gap-1.5 text-[11px] text-slate-600"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {axisProgress.map((p) => (
                  <span
                    key={p.axis}
                    className={`rounded-md px-2 py-1 font-medium ${
                      p.done === p.total
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {p.axis} {p.done}/{p.total}
                  </span>
                ))}
              </div>

              {activeResult.allNa && (
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Warning: all evaluated criteria are N/A on the active route — global score returned
                  as 0.00.
                </div>
              )}

              {activeResult.incomplete && evaluatedCount === 0 && (
                <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No criteria answered yet on this route. Petals stay outlined until you select a
                  value, N/A, or A-NC.
                </div>
              )}

              {activeResult.incomplete && evaluatedCount > 0 && evaluatedCount < 12 && (
                <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Provisional score from {evaluatedCount}/12 criteria — treat as incomplete until the
                  full route is evaluated.
                </div>
              )}

              <BiogreenPictogram
                proposed={evaluation.proposed}
                baseline={evaluation.baseline}
                previewRoute={activeRoute}
              />

              <div className="mt-4 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
                <Kpi
                  label="S proposed"
                  value={formatScore(proposedResult.score)}
                  emphasize={activeRoute === 'proposed'}
                  hint={
                    proposedResult.incomplete && proposedResult.score !== null
                      ? `partial ${proposedCount}/12`
                      : undefined
                  }
                />
                <Kpi
                  label="S baseline"
                  value={formatScore(baselineResult.score)}
                  emphasize={activeRoute === 'baseline'}
                  hint={
                    baselineCount === 0
                      ? 'needed for ΔS'
                      : baselineResult.incomplete && baselineResult.score !== null
                        ? `partial ${baselineCount}/12`
                        : undefined
                  }
                />
                <Kpi
                  label="ΔS"
                  value={delta === null ? '—' : formatScore(delta)}
                  badge={
                    delta === null
                      ? undefined
                      : delta > 0
                        ? 'positive'
                        : delta < 0
                          ? 'negative'
                          : 'neutral'
                  }
                  hint={delta === null ? 'Fill Route B' : undefined}
                />
              </div>

              {!baselineReady && (
                <p className="mt-2 text-[11px] font-medium text-slate-600">
                  Fill Route B to compute ΔS.
                </p>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Export results
                </p>
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <ExportButton
                    label="Export SVG"
                    onClick={() => exportSvg(exportCtx)}
                    primary
                  />
                  <ExportButton
                    label="Export 300-DPI PNG"
                    onClick={() => void exportPng(exportCtx)}
                    primary
                  />
                  <ExportButton
                    label="Export PDF / Report"
                    onClick={() => exportPdfReport(evaluation)}
                    primary
                    className="col-span-2"
                  />
                  <ExportButton
                    label="Export project (.biogreen.json)"
                    onClick={() => exportProjectFile(ws.activeProject!)}
                    className="col-span-2"
                  />
                  <ExportButton
                    label="Export all projects"
                    onClick={() =>
                      exportAllProjects(ws.activeProjects, ws.activeProjectId)
                    }
                  />
                  <ExportButton
                    label="Import .biogreen.json"
                    onClick={() => fileInputRef.current?.click()}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json,.biogreen.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImportFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                {isTauriRuntime() && (
                  <p className="mt-2 text-[11px] text-slate-600">
                    Desktop builds can also open/save real files from disk — use Export project for
                    a portable copy that works across browsers and machines.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        <SideBySideComparison
          evaluation={evaluation}
          open={sideBySideOpen}
          onToggle={() => ws.setUi({ sideBySideOpen: !sideBySideOpen })}
        />
      </main>

      {ws.undoToast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg">
          <span className="min-w-0 text-slate-700">
            {ws.undoToast.kind === 'delete'
              ? `“${ws.undoToast.project.title}” moved to trash (30 days).`
              : `“${ws.undoToast.project.title}” was reset.`}
          </span>
          <button
            type="button"
            onClick={() => void ws.undoLast()}
            className="shrink-0 font-semibold text-slate-900 underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  badge,
  emphasize,
  hint,
}: {
  label: string;
  value: string;
  badge?: 'positive' | 'negative' | 'neutral';
  emphasize?: boolean;
  hint?: string;
}) {
  const badgeCls =
    badge === 'positive'
      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
      : badge === 'negative'
        ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
        : badge === 'neutral'
          ? 'bg-slate-50 text-slate-800'
          : emphasize
            ? 'border-2 border-slate-900 bg-white'
            : 'border border-slate-200 bg-slate-50';

  return (
    <div className={`min-w-0 rounded-md px-1.5 py-2 sm:px-2.5 ${badgeCls}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-600 sm:text-[10px]">
        {label}
      </div>
      <div
        className="text-base font-bold sm:text-lg"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-[9px] font-medium text-slate-600">{hint}</div>
      )}
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  className = '',
  primary = false,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
        primary
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      } ${className}`}
    >
      {label}
    </button>
  );
}
