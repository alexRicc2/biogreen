import type { EvaluationState } from '../types/biogreen';
import { CRITERIA } from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  formatScore,
  isCriterionEvaluated,
  modeLabel,
  resolveCriterionScore,
} from '../utils/calculator';

interface Props {
  evaluation: EvaluationState;
}

export default function ComparisonTable({ evaluation }: Props) {
  const proposed = computeGlobalScore(evaluation.proposed);
  const baseline = computeGlobalScore(evaluation.baseline);
  const delta = computeDeltaS(proposed.score, baseline.score);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-3 sm:px-4">
        <h2 className="text-sm font-semibold text-slate-900">Criterion Comparison</h2>
        <p className="text-xs text-slate-500">
          Side-by-side Proposed vs Baseline · ΔS ={' '}
          <span className="font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatScore(delta)}
          </span>
        </p>
      </div>
      <div className="-mx-0 overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Criterion</th>
              <th className="px-3 py-2 font-medium">W</th>
              <th className="px-3 py-2 font-medium">Proposed</th>
              <th className="px-3 py-2 font-medium">Baseline</th>
              <th className="px-3 py-2 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => {
              const pState = evaluation.proposed.criteria[c.id];
              const bState = evaluation.baseline.criteria[c.id];
              const pEval = isCriterionEvaluated(c.id, pState);
              const bEval = isCriterionEvaluated(c.id, bState);
              const pScore = resolveCriterionScore(c.id, pState);
              const bScore = resolveCriterionScore(c.id, bState);
              const rowDelta =
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
                  <td className="px-3 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {c.weight.toFixed(1)}
                  </td>
                  <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <ModeBadge mode={pState.mode} evaluated={pEval} />{' '}
                    {!pEval ? '—' : pState.mode === 'NA' ? '—' : formatScore(pScore)}
                  </td>
                  <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <ModeBadge mode={bState.mode} evaluated={bEval} />{' '}
                    {!bEval ? '—' : bState.mode === 'NA' ? '—' : formatScore(bScore)}
                  </td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      rowDelta === null
                        ? 'text-slate-400'
                        : rowDelta > 0
                          ? 'text-emerald-700'
                          : rowDelta < 0
                            ? 'text-red-700'
                            : 'text-slate-600'
                    }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {rowDelta === null ? '—' : formatScore(rowDelta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Global score
              </td>
              <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatScore(proposed.score)}
              </td>
              <td className="px-3 py-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatScore(baseline.score)}
              </td>
              <td
                className={`px-3 py-2 ${
                  delta === null
                    ? 'text-slate-400'
                    : delta > 0
                      ? 'text-emerald-700'
                      : delta < 0
                        ? 'text-red-700'
                        : 'text-slate-700'
                }`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatScore(delta)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ModeBadge({ mode, evaluated }: { mode: string; evaluated: boolean }) {
  if (!evaluated || mode === 'UNANSWERED') {
    return (
      <span className="mr-1 inline-block rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
        Unanswered
      </span>
    );
  }
  const label = modeLabel(mode as 'VALID' | 'NA' | 'ANC' | 'UNANSWERED');
  const cls =
    mode === 'VALID'
      ? 'bg-emerald-50 text-emerald-800'
      : mode === 'NA'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-amber-50 text-amber-800';
  return (
    <span className={`mr-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
