import { useState } from 'react';
import type { CriterionDefinition, CriterionMode, CriterionState } from '../types/biogreen';
import {
  formatScore,
  isCriterionEvaluated,
  resolveCriterionScore,
  scoreEFactor,
  scoreTransport,
  scoreWater,
  computeEFactor,
} from '../utils/calculator';
import { contrastTextForScore, scoreToColor } from '../utils/colors';
import { WATER_TIERS } from '../data/criteriaConfig';

interface Props {
  definition: CriterionDefinition;
  state: CriterionState;
  onChange: (next: CriterionState) => void;
}

const NA_TOOLTIP =
  'N/A — Not Applicable: criterion does not apply to this route. Weight Wi is set to 0 and excluded from the global score.';
const ANC_TOOLTIP =
  'A-NC — Applies, but Cannot be Calculated: data omitted/unreported. Penalized at Si = −0.25 with full weight Wi retained.';

const MODE_LABELS: {
  value: CriterionMode;
  label: string;
  hint: string;
  tooltip?: string;
}[] = [
  { value: 'VALID', label: 'VALID', hint: 'Measured / Applicable' },
  { value: 'NA', label: 'N/A', hint: 'Not Applicable', tooltip: NA_TOOLTIP },
  {
    value: 'ANC',
    label: 'A-NC',
    hint: 'Applies, Cannot be Calculated',
    tooltip: ANC_TOOLTIP,
  },
];

export default function CriterionCard({ definition, state, onChange }: Props) {
  const evaluated = isCriterionEvaluated(definition.id, state);
  const liveScore = resolveCriterionScore(definition.id, state);
  const inputsEnabled = state.mode === 'VALID' || state.mode === 'UNANSWERED';
  const isFlagMode = state.mode === 'NA' || state.mode === 'ANC';

  const patch = (partial: Partial<CriterionState>) => onChange({ ...state, ...partial });

  const badgeBg = evaluated
    ? scoreToColor(liveScore ?? 0, state.mode)
    : '#FFFFFF';
  const badgeFg = evaluated
    ? contrastTextForScore(liveScore ?? 0, state.mode)
    : '#64748B';
  const badgeBorder = evaluated ? 'transparent' : '#CBD5E1';

  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        evaluated ? 'border-slate-200' : 'border-dashed border-slate-300'
      }`}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-slate-900 px-1.5 text-xs font-semibold text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {definition.id}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{definition.title}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {definition.pillar} pillar · W ={' '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{definition.weight.toFixed(1)}</span>
          </p>
        </div>
        <div
          className="rounded-md px-2.5 py-1 text-sm font-semibold"
          style={{
            background: badgeBg,
            color: badgeFg,
            border: `1px solid ${badgeBorder}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {evaluated
            ? state.mode === 'NA'
              ? 'S = —'
              : `S = ${formatScore(liveScore)}`
            : 'Unanswered'}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-1 rounded-md bg-slate-100 p-1">
        {MODE_LABELS.map((m) => (
          <button
            key={m.value}
            type="button"
            title={m.tooltip ?? m.hint}
            onClick={() => {
              if (m.value === 'VALID') {
                patch({ mode: 'VALID' });
              } else {
                patch({ mode: m.value });
              }
            }}
            className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
              state.mode === m.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {m.label}
            {m.tooltip && (
              <span
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600"
                title={m.tooltip}
                aria-label={m.tooltip}
              >
                ?
              </span>
            )}
          </button>
        ))}
      </div>

      {state.mode === 'NA' && (
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">Not Applicable (N/A)</p>
          <p className="mt-1">
            This criterion does not apply to this synthesis route (e.g., solvent selection in a
            solvent-free process). Its weight (W<sub>i</sub>) is set to 0 and excluded from both
            numerator and denominator.
          </p>
        </div>
      )}

      {state.mode === 'ANC' && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
          <p className="font-semibold text-amber-950">Applies, but Cannot be Calculated (A-NC)</p>
          <p className="mt-1">
            This parameter applies to the process, but required data was omitted or unreported.
            Automatically penalized at S<sub>i</sub> = −0.25 with full weight (W<sub>i</sub>) retained
            to discourage incomplete reporting.
          </p>
        </div>
      )}

      {!evaluated && !isFlagMode && (
        <p className="mb-3 text-xs text-slate-500">
          Select an anchor score, enter quantitative values, or mark N/A / A-NC.
        </p>
      )}

      {inputsEnabled && (
        <div>
          {definition.inputType === 'categorical' && (
            <CategoricalInputs definition={definition} state={state} patch={patch} />
          )}
          {definition.inputType === 'dual_quantitative' && (
            <DualQuantitativeInputs state={state} patch={patch} />
          )}
          {definition.inputType === 'efactor' && (
            <EFactorInputs state={state} patch={patch} />
          )}
        </div>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {isFlagMode ? 'Justification (optional)' : 'Justification / Reference Note'}
        </span>
        {isFlagMode ? (
          <input
            type="text"
            value={state.justification}
            onChange={(e) => patch({ justification: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400"
            placeholder="Why this flag applies — included in PDF/JSON exports…"
          />
        ) : (
          <textarea
            value={state.justification}
            onChange={(e) => patch({ justification: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-slate-400"
            placeholder="Optional citation or edge-case note…"
          />
        )}
      </label>
    </article>
  );
}

function CategoricalInputs({
  definition,
  state,
  patch,
}: {
  definition: CriterionDefinition;
  state: CriterionState;
  patch: (p: Partial<CriterionState>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {definition.anchors.map((a) => {
          const selected =
            state.mode !== 'UNANSWERED' &&
            !state.useCustomScore &&
            state.score === a.score;
          return (
            <label
              key={`${a.score}-${a.label}`}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition ${
                selected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name={`criterion-${definition.id}`}
                className="mt-1"
                checked={selected}
                onChange={() =>
                  patch({ mode: 'VALID', useCustomScore: false, score: a.score })
                }
              />
              <span className="flex-1 text-slate-700">{a.label}</span>
              <span
                className="shrink-0 font-semibold text-slate-900"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatScore(a.score)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={state.useCustomScore && state.mode === 'VALID'}
            onChange={(e) => {
              if (e.target.checked) {
                patch({
                  mode: 'VALID',
                  useCustomScore: true,
                  score: state.score ?? 0,
                });
              } else {
                patch({ useCustomScore: false, score: null, mode: 'UNANSWERED' });
              }
            }}
          />
          Custom / Intermediate Score
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            disabled={!state.useCustomScore || state.mode !== 'VALID'}
            value={state.score ?? 0}
            onChange={(e) =>
              patch({
                mode: 'VALID',
                useCustomScore: true,
                score: Number(e.target.value),
              })
            }
            className="w-full accent-slate-900"
          />
          <span
            className="w-14 text-right text-sm font-semibold text-slate-900"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {state.useCustomScore && state.score !== null ? formatScore(state.score) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DualQuantitativeInputs({
  state,
  patch,
}: {
  state: CriterionState;
  patch: (p: Partial<CriterionState>) => void;
}) {
  const c2 = state.criterion2;
  const transportDisplay =
    c2?.transportKm !== undefined ? String(c2.transportKm) : '';
  const waterDisplay =
    c2?.waterFootprintLkg !== undefined ? String(c2.waterFootprintLkg) : '';
  const sTrans =
    c2?.transportKm !== undefined ? scoreTransport(c2.transportKm) : null;
  const sWater =
    c2?.waterFootprintLkg !== undefined ? scoreWater(c2.waterFootprintLkg) : null;
  const complete =
    c2?.transportKm !== undefined && c2?.waterFootprintLkg !== undefined;

  const mergeC2 = (partial: { transportKm?: number; waterFootprintLkg?: number }) => {
    const next = { ...c2, ...partial };
    const bothReady =
      next.transportKm !== undefined && next.waterFootprintLkg !== undefined;
    patch({
      mode: bothReady ? 'VALID' : 'UNANSWERED',
      criterion2: next,
    });
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Transport distance d (km)
        </span>
        <input
          type="number"
          min={0}
          step={1}
          placeholder="Enter distance…"
          value={transportDisplay}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              const { transportKm: _t, ...rest } = c2 ?? {};
              patch({
                mode: 'UNANSWERED',
                criterion2:
                  rest.waterFootprintLkg !== undefined
                    ? { waterFootprintLkg: rest.waterFootprintLkg }
                    : undefined,
              });
              return;
            }
            mergeC2({ transportKm: Math.max(0, Number(raw) || 0) });
          }}
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <p className="mt-1 text-xs text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
          S<sub>trans</sub> = {sTrans === null ? '—' : formatScore(sTrans)}
        </p>
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Water footprint (L kg⁻¹)
        </span>
        <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {WATER_TIERS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => mergeC2({ waterFootprintLkg: t.value })}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
                sWater === t.score
                  ? 'border-slate-900 bg-slate-50 text-slate-900'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          step={1}
          placeholder="Enter water footprint…"
          value={waterDisplay}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              const { waterFootprintLkg: _w, ...rest } = c2 ?? {};
              patch({
                mode: 'UNANSWERED',
                criterion2:
                  rest.transportKm !== undefined
                    ? { transportKm: rest.transportKm }
                    : undefined,
              });
              return;
            }
            mergeC2({ waterFootprintLkg: Math.max(0, Number(raw) || 0) });
          }}
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <p className="mt-1 text-xs text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
          S<sub>water</sub> = {sWater === null ? '—' : formatScore(sWater)}
          {complete && sTrans !== null && sWater !== null && (
            <>
              {' '}
              · Combined S₂ = {formatScore((sTrans + sWater) / 2)}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function EFactorInputs({
  state,
  patch,
}: {
  state: CriterionState;
  patch: (p: Partial<CriterionState>) => void;
}) {
  const c8 = state.criterion8;
  const [uiMode, setUiMode] = useState<'efactor' | 'masses'>(c8?.inputMode ?? 'efactor');
  const inputMode = c8?.inputMode ?? uiMode;

  const e =
    c8 == null
      ? null
      : c8.inputMode === 'masses'
        ? Number.isFinite(c8.wasteMassKg) && Number.isFinite(c8.productMassKg)
          ? computeEFactor(c8.wasteMassKg, c8.productMassKg)
          : null
        : Number.isFinite(c8.eFactor)
          ? c8.eFactor
          : null;
  const s = e === null ? null : scoreEFactor(e);

  const commitEfactor = (eFactor: number) => {
    patch({
      mode: 'VALID',
      criterion8: {
        inputMode: 'efactor',
        eFactor,
        wasteMassKg: c8?.wasteMassKg ?? 0,
        productMassKg: c8?.productMassKg ?? 1,
      },
    });
  };

  const commitMasses = (wasteMassKg: number, productMassKg: number) => {
    const ready = Number.isFinite(wasteMassKg) && Number.isFinite(productMassKg) && productMassKg > 0;
    patch({
      mode: ready ? 'VALID' : 'UNANSWERED',
      criterion8: ready
        ? {
            inputMode: 'masses',
            eFactor: c8?.eFactor ?? 0,
            wasteMassKg,
            productMassKg,
          }
        : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setUiMode('efactor');
            if (c8) patch({ criterion8: { ...c8, inputMode: 'efactor' } });
          }}
          className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold ${
            inputMode === 'efactor' ? 'bg-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Enter E-Factor
        </button>
        <button
          type="button"
          onClick={() => {
            setUiMode('masses');
            if (c8) patch({ criterion8: { ...c8, inputMode: 'masses' } });
          }}
          className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold ${
            inputMode === 'masses' ? 'bg-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Mass calculator
        </button>
      </div>

      {inputMode === 'efactor' ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">E-Factor</span>
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="Enter E-Factor…"
            value={c8 && Number.isFinite(c8.eFactor) ? String(c8.eFactor) : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                patch({ mode: 'UNANSWERED', criterion8: undefined });
                return;
              }
              commitEfactor(Math.max(0, Number(raw) || 0));
            }}
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Total Waste Mass (kg)
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              placeholder="Waste…"
              value={c8 && Number.isFinite(c8.wasteMassKg) ? String(c8.wasteMassKg) : ''}
              onChange={(e) => {
                const raw = e.target.value;
                const waste = raw === '' ? Number.NaN : Math.max(0, Number(raw) || 0);
                const product = c8 && Number.isFinite(c8.productMassKg) ? c8.productMassKg : Number.NaN;
                if (raw === '' && !Number.isFinite(product)) {
                  patch({ mode: 'UNANSWERED', criterion8: undefined });
                  return;
                }
                commitMasses(waste, product);
              }}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Final Product Mass (kg)
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              placeholder="Product…"
              value={c8 && Number.isFinite(c8.productMassKg) ? String(c8.productMassKg) : ''}
              onChange={(e) => {
                const raw = e.target.value;
                const product = raw === '' ? Number.NaN : Math.max(0, Number(raw) || 0);
                const waste = c8 && Number.isFinite(c8.wasteMassKg) ? c8.wasteMassKg : Number.NaN;
                if (raw === '' && !Number.isFinite(waste)) {
                  patch({ mode: 'UNANSWERED', criterion8: undefined });
                  return;
                }
                commitMasses(waste, product);
              }}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </label>
        </div>
      )}

      <p className="text-xs text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {e === null
          ? 'Enter values to compute S₈'
          : `E-Factor = ${Number.isFinite(e) ? e.toFixed(2) : '∞'} → S₈ = ${formatScore(s)}`}
      </p>
    </div>
  );
}
