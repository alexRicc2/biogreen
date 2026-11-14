import { useMemo, useState, type RefObject } from 'react';
import type { CriterionMode, RouteState } from '../types/biogreen';
import { CRITERIA_BY_ID } from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  formatScore,
  isCriterionEvaluated,
  modeLabel,
  resolveCriterionScore,
  resolveEffectiveWeight,
} from '../utils/calculator';
import { contrastTextForScore, scoreToColor } from '../utils/colors';
import {
  AXIS_R,
  CX,
  CY,
  INNER,
  LABEL_R,
  OUTER,
  VIEW,
  arcPath,
  axisGroups,
  donutSector,
  layoutAngles,
  polar,
} from '../utils/pictogramSvg';

export type PreviewRoute = 'proposed' | 'baseline';

interface Props {
  proposed: RouteState;
  baseline: RouteState;
  previewRoute: PreviewRoute;
  /** Compact mode for side-by-side panels */
  compact?: boolean;
  showPreviewLabel?: boolean;
  showUiLegend?: boolean;
  svgRef?: RefObject<SVGSVGElement | null>;
}

interface SectorGeom {
  id: number;
  path: string;
  color: string;
  unanswered: boolean;
  dashed: boolean;
  labelX: number;
  labelY: number;
  mode: CriterionMode;
  score: number | null;
  weight: number;
  title: string;
  evaluated: boolean;
}

export default function BiogreenPictogram({
  proposed,
  baseline,
  previewRoute,
  compact = false,
  showPreviewLabel = true,
  showUiLegend = true,
  svgRef,
}: Props) {
  const [tooltip, setTooltip] = useState<{ id: number; x: number; y: number } | null>(null);

  const preview = previewRoute === 'proposed' ? proposed : baseline;
  const proposedScore = useMemo(() => computeGlobalScore(proposed), [proposed]);
  const baselineScore = useMemo(() => computeGlobalScore(baseline), [baseline]);
  const previewScore = previewRoute === 'proposed' ? proposedScore : baselineScore;
  const delta = computeDeltaS(proposedScore.score, baselineScore.score);

  const sectors = useMemo((): SectorGeom[] => {
    const { starts, ends, mids } = layoutAngles();
    const out: SectorGeom[] = [];
    for (let i = 0; i < 12; i++) {
      const id = i + 1;
      const state = preview.criteria[id];
      const def = CRITERIA_BY_ID[id];
      const evaluated = isCriterionEvaluated(id, state);
      const unanswered = !evaluated;
      const score = resolveCriterionScore(id, state);
      const label = polar(CX, CY, LABEL_R, mids[i]);
      out.push({
        id,
        path: donutSector(CX, CY, INNER, OUTER, starts[i], ends[i]),
        color: scoreToColor(score ?? 0, state.mode, { unanswered }),
        unanswered,
        dashed: unanswered || state.mode === 'NA',
        labelX: label.x,
        labelY: label.y,
        mode: state.mode,
        score,
        weight: def.weight,
        title: def.title,
        evaluated,
      });
    }
    return out;
  }, [preview]);

  const axes = useMemo(() => axisGroups(), []);

  const hubUnanswered = previewScore.score === null;
  const hubColor = hubUnanswered
    ? '#F1F5F9'
    : scoreToColor(previewScore.score ?? 0, previewScore.allNa ? 'NA' : 'VALID');
  const hubText = contrastTextForScore(
    previewScore.score ?? 0,
    previewScore.allNa ? 'NA' : hubUnanswered ? 'UNANSWERED' : 'VALID',
    { unanswered: hubUnanswered },
  );

  const tipSector = tooltip ? sectors.find((s) => s.id === tooltip.id) : null;
  const previewLabel =
    previewRoute === 'proposed'
      ? 'Previewing: Route A (Proposed)'
      : 'Previewing: Route B (Baseline)';

  return (
    <div className="relative w-full">
      {showPreviewLabel && (
        <p className="mb-2 text-center text-xs font-semibold text-slate-600">{previewLabel}</p>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label="BIOGREEN 12-petal radar pictogram"
        className={`mx-auto h-auto w-full ${compact ? 'max-w-[280px]' : 'max-w-[440px]'}`}
      >
        <rect width={VIEW} height={VIEW} fill="#FFFFFF" />

        {axes.map((a) => (
          <g key={a.axis}>
            <path
              d={arcPath(CX, CY, AXIS_R, a.start, a.end)}
              fill="none"
              stroke={a.color}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.85}
            />
            <path
              d={`M ${polar(CX, CY, AXIS_R - 5, a.start).x} ${polar(CX, CY, AXIS_R - 5, a.start).y} L ${polar(CX, CY, AXIS_R + 5, a.start).x} ${polar(CX, CY, AXIS_R + 5, a.start).y}`}
              stroke={a.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <path
              d={`M ${polar(CX, CY, AXIS_R - 5, a.end).x} ${polar(CX, CY, AXIS_R - 5, a.end).y} L ${polar(CX, CY, AXIS_R + 5, a.end).x} ${polar(CX, CY, AXIS_R + 5, a.end).y}`}
              stroke={a.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <text
              x={a.labelPos.x}
              y={a.labelPos.y}
              textAnchor={a.textAnchor}
              dominantBaseline="central"
              fill={a.color}
              style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}
            >
              {a.label}
            </text>
          </g>
        ))}

        {sectors.map((s) => (
          <g key={s.id}>
            <path
              d={s.path}
              fill={s.color}
              fillOpacity={s.unanswered ? 0.35 : s.mode === 'NA' ? 0.55 : 0.95}
              stroke={s.unanswered ? '#CBD5E1' : s.mode === 'NA' ? '#94A3B8' : '#FFFFFF'}
              strokeWidth={s.unanswered || s.mode === 'NA' ? 1.75 : 1}
              strokeDasharray={s.dashed ? '4 3' : undefined}
              className="cursor-pointer transition-opacity hover:opacity-85"
              onMouseEnter={(e) => {
                const rect = (e.target as SVGPathElement).ownerSVGElement?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({ id: s.id, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseMove={(e) => {
                const rect = (e.target as SVGPathElement).ownerSVGElement?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({ id: s.id, x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
            <text
              x={s.labelX}
              y={s.labelY}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-700"
              style={{ fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {s.id}
            </text>
          </g>
        ))}

        <circle cx={CX} cy={CY} r={INNER - 4} fill={hubColor} />
        <circle
          cx={CX}
          cy={CY}
          r={INNER - 4}
          fill="none"
          stroke={hubUnanswered ? '#CBD5E1' : '#FFFFFF'}
          strokeWidth={3}
        />
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          fill={hubText}
          style={{ fontSize: compact ? '18px' : '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatScore(previewScore.score)}
        </text>
        <text
          x={CX}
          y={CY + 16}
          textAnchor="middle"
          fill={hubText}
          opacity={0.9}
          style={{ fontSize: compact ? '11px' : '12px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
        >
          ΔS = {formatScore(delta)}
        </text>
      </svg>

      {showUiLegend && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
          <LegendSwatch color="#15803D" label="Green: +0.50 to +1.00" />
          <LegendSwatch color="#F59E0B" label="Yellow: 0.00 to +0.49" />
          <LegendSwatch color="#B91C1C" label="Red: −1.00 to −0.01" />
          <LegendSwatch color="#E2E8F0" label="Light Gray: N/A" border />
          <LegendSwatch color="#475569" label="Dark Gray: A-NC (−0.25)" />
          <LegendSwatch color="#FFFFFF" label="Outline: Unanswered" border dashed />
        </div>
      )}

      {tooltip && tipSector && (
        <div
          className="pointer-events-none absolute z-10 max-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(tooltip.x + 12, 260),
            top: Math.max(tooltip.y - 10, 8),
          }}
        >
          <div className="font-semibold text-slate-900">
            {tipSector.id}. {tipSector.title}
          </div>
          <div className="mt-1 space-y-0.5 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <div>Weight W = {tipSector.weight.toFixed(1)}</div>
            <div>Status: {modeLabel(tipSector.mode)}</div>
            <div>
              Score:{' '}
              {!tipSector.evaluated
                ? 'Unanswered'
                : tipSector.mode === 'NA'
                  ? 'excluded'
                  : formatScore(tipSector.score)}
            </div>
            <div>
              Effective W ={' '}
              {resolveEffectiveWeight(
                tipSector.id,
                preview.criteria[tipSector.id],
                tipSector.weight,
              ).toFixed(1)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  border,
  dashed,
}: {
  color: string;
  label: string;
  border?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
        style={{
          background: color,
          border: border ? '1px solid #94A3B8' : undefined,
          borderStyle: dashed ? 'dashed' : border ? 'solid' : undefined,
        }}
      />
      <span>{label}</span>
    </span>
  );
}
