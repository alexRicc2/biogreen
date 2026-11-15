import { useMemo, useRef, useState } from 'react';
import type { CriterionState, EvaluationState } from '../types/biogreen';
import {
  AXIS_GROUPS,
  CRITERIA_BY_ID,
  PRESETS,
  createEmptyEvaluation,
} from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  countEvaluated,
  formatScore,
} from '../utils/calculator';
import {
  exportJson,
  exportPdfReport,
  exportPng,
  exportSvg,
  importJson,
} from '../utils/exporters';
import BiogreenPictogram from './BiogreenPictogram';
import ComparisonTable from './ComparisonTable';
import CriterionCard from './CriterionCard';
import SideBySideComparison from './SideBySideComparison';

type ActiveRoute = 'proposed' | 'baseline';

export default function BiogreenApp() {
  const [evaluation, setEvaluation] = useState<EvaluationState>(() =>
    structuredClone(PRESETS[1].evaluation),
  );
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('proposed');
  const [presetId, setPresetId] = useState(PRESETS[1].id);
  const [openAxes, setOpenAxes] = useState<Record<string, boolean>>({
    A: true,
    B: true,
    C: true,
  });
  const [sideBySideOpen, setSideBySideOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const proposedResult = useMemo(
    () => computeGlobalScore(evaluation.proposed),
    [evaluation.proposed],
  );
  const baselineResult = useMemo(
    () => computeGlobalScore(evaluation.baseline),
    [evaluation.baseline],
  );
  const delta = computeDeltaS(proposedResult.score, baselineResult.score);

  const activeRouteState =
    activeRoute === 'proposed' ? evaluation.proposed : evaluation.baseline;
  const evaluatedCount = countEvaluated(activeRouteState);
  const activeResult = activeRoute === 'proposed' ? proposedResult : baselineResult;
  const route = activeRouteState;

  const exportCtx = useMemo(() => {
    const isProposed = activeRoute === 'proposed';
    return {
      route: isProposed ? evaluation.proposed : evaluation.baseline,
      otherRoute: isProposed ? evaluation.baseline : evaluation.proposed,
      routeTitle: isProposed
        ? `Route A — Proposed · ${evaluation.projectTitle}`
        : `Route B — Baseline · ${evaluation.projectTitle}`,
    };
  }, [activeRoute, evaluation]);

  const updateCriterion = (id: number, next: CriterionState) => {
    setEvaluation((prev) => {
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
    setEvaluation((prev) => ({
      ...prev,
      baseline: {
        label: prev.baseline.label,
        criteria: structuredClone(prev.proposed.criteria),
      },
    }));
  };

  const loadPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setEvaluation(structuredClone(preset.evaluation));
  };

  const resetAll = () => {
    setEvaluation(createEmptyEvaluation());
    setActiveRoute('proposed');
    setPresetId('blank');
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const data = importJson(text);
    setEvaluation(data);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Circular Bioeconomy Material Metric
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              BIOGREEN
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="hidden text-slate-500 sm:inline">Preset</span>
              <select
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                value={presetId}
                onChange={(e) => loadPreset(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
            <a
              href="https://github.com/alexRicc2/biogreen/releases"
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download Desktop App
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:items-start">
          <section className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Project title</span>
                <input
                  type="text"
                  value={evaluation.projectTitle}
                  onChange={(e) =>
                    setEvaluation((prev) => ({ ...prev, projectTitle: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-1 rounded-md bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveRoute('proposed')}
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold transition ${
                      activeRoute === 'proposed'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    Route A: Proposed (S<sub>proposed</sub>)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRoute('baseline')}
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold transition ${
                      activeRoute === 'baseline'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    Route B: Baseline (S<sub>baseline</sub>)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copyProposedToBaseline}
                  title="Shortcut: copies Route A inputs into Route B so you only modify what changed"
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Copy Proposed → Baseline
                </button>
              </div>
            </div>

            {AXIS_GROUPS.map((group) => (
              <div
                key={group.axis}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenAxes((prev) => ({ ...prev, [group.axis]: !prev[group.axis] }))
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">{group.label}</span>
                  <span className="text-slate-400">{openAxes[group.axis] ? '−' : '+'}</span>
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
            ))}

            <ComparisonTable evaluation={evaluation} />
          </section>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Live Results & Pictogram</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    evaluatedCount === 12
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {evaluatedCount} / 12 criteria evaluated
                </span>
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

              <BiogreenPictogram
                proposed={evaluation.proposed}
                baseline={evaluation.baseline}
                previewRoute={activeRoute}
              />

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Kpi
                  label="S proposed"
                  value={formatScore(proposedResult.score)}
                  emphasize={activeRoute === 'proposed'}
                />
                <Kpi
                  label="S baseline"
                  value={formatScore(baselineResult.score)}
                  emphasize={activeRoute === 'baseline'}
                />
                <Kpi
                  label="ΔS"
                  value={formatScore(delta)}
                  badge={
                    delta === null
                      ? undefined
                      : delta > 0
                        ? 'positive'
                        : delta < 0
                          ? 'negative'
                          : 'neutral'
                  }
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ExportButton label="Export SVG" onClick={() => exportSvg(exportCtx)} />
                <ExportButton
                  label="Export 300-DPI PNG"
                  onClick={() => void exportPng(exportCtx)}
                />
                <ExportButton
                  label="Export PDF / Report"
                  onClick={() => exportPdfReport(evaluation)}
                />
                <ExportButton label="Export JSON" onClick={() => exportJson(evaluation)} />
                <ExportButton
                  label="Import JSON"
                  onClick={() => fileInputRef.current?.click()}
                  className="col-span-2"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </aside>
        </div>

        <SideBySideComparison
          evaluation={evaluation}
          open={sideBySideOpen}
          onToggle={() => setSideBySideOpen((v) => !v)}
        />
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  badge,
  emphasize,
}: {
  label: string;
  value: string;
  badge?: 'positive' | 'negative' | 'neutral';
  emphasize?: boolean;
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
    <div className={`rounded-md px-2.5 py-2 ${badgeCls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${className}`}
    >
      {label}
    </button>
  );
}
