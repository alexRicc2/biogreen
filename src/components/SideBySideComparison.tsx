import type { EvaluationState } from '../types/biogreen';
import { CRITERIA } from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  formatScore,
  isCriterionEvaluated,
  resolveCriterionScore,
} from '../utils/calculator';
import BiogreenPictogram from './BiogreenPictogram';

interface Props {
  evaluation: EvaluationState;
  open: boolean;
  onToggle: () => void;
}

export default function SideBySideComparison({ evaluation, open, onToggle }: Props) {
  const proposed = computeGlobalScore(evaluation.proposed);
  const baseline = computeGlobalScore(evaluation.baseline);
  const delta = computeDeltaS(proposed.score, baseline.score);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            Side-by-Side Route Comparison
          </h2>
          <p className="text-xs text-slate-500">
            Publication-ready view of S<sub>proposed</sub>, S<sub>baseline</sub>, and per-criterion ΔS
            <sub>i</sub>
          </p>
        </div>
        <span className="shrink-0 text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="min-w-0 space-y-4 border-t border-slate-100 p-3 sm:p-4">
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Route A · Proposed · {formatScore(proposed.score)}
              </p>
              <BiogreenPictogram
                proposed={evaluation.proposed}
                baseline={evaluation.baseline}
                previewRoute="proposed"
                compact
                showPreviewLabel={false}
                showUiLegend={false}
              />
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Route B · Baseline · {formatScore(baseline.score)}
              </p>
              <BiogreenPictogram
                proposed={evaluation.proposed}
                baseline={evaluation.baseline}
                previewRoute="baseline"
                compact
                showPreviewLabel={false}
                showUiLegend={false}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">
              Global ΔS = S<sub>proposed</sub> − S<sub>baseline</sub>
            </span>
            <span
              className={`font-bold ${
                delta === null
                  ? 'text-slate-400'
                  : delta > 0
                    ? 'text-emerald-700'
                    : delta < 0
                      ? 'text-red-700'
                      : 'text-slate-800'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatScore(delta)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Criterion</th>
                  <th className="px-3 py-2 font-medium">S<sub>i, proposed</sub></th>
                  <th className="px-3 py-2 font-medium">S<sub>i, baseline</sub></th>
                  <th className="px-3 py-2 font-medium">ΔS<sub>i</sub></th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map((c) => {
                  const pState = evaluation.proposed.criteria[c.id];
                  const bState = evaluation.baseline.criteria[c.id];
                  const pScore = resolveCriterionScore(c.id, pState);
                  const bScore = resolveCriterionScore(c.id, bState);
                  const pEval = isCriterionEvaluated(c.id, pState);
                  const bEval = isCriterionEvaluated(c.id, bState);
                  const d =
                    pScore !== null && bScore !== null ? pScore - bScore : null;

                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td
                        className="px-3 py-2 font-semibold text-slate-700"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {c.id}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{c.title}</td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {!pEval || pState.mode === 'NA' ? '—' : formatScore(pScore)}
                      </td>
                      <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {!bEval || bState.mode === 'NA' ? '—' : formatScore(bScore)}
                      </td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          d === null
                            ? 'text-slate-400'
                            : d > 0
                              ? 'text-emerald-700'
                              : d < 0
                                ? 'text-red-700'
                                : 'text-slate-600'
                        }`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {d === null ? '—' : formatScore(d)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
