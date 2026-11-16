import type { RouteState } from '../types/biogreen';
import { BIOGREEN_RUBRIC_VERSION } from '../types/biogreen';
import { CRITERIA_BY_ID } from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  formatScore,
  isCriterionEvaluated,
  resolveCriterionScore,
} from './calculator';
import { contrastTextForScore, scoreToColor } from './colors';

export const CX = 240;
export const CY = 240;
export const OUTER = 142;
export const INNER = 68;
export const LABEL_R = 158;
export const AXIS_R = 176;
export const AXIS_LABEL_R = 214;
export const VIEW = 480;

/** Distinct axis accent colors (not score traffic-lights). */
export const AXIS_COLORS = {
  A: '#0F766E',
  B: '#1D4ED8',
  C: '#C2410C',
} as const;

export function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function donutSector(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startAngle: number,
  endAngle: number,
): string {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const os = polar(cx, cy, outer, startAngle);
  const oe = polar(cx, cy, outer, endAngle);
  const is = polar(cx, cy, inner, startAngle);
  const ie = polar(cx, cy, inner, endAngle);
  return [
    `M ${os.x} ${os.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${oe.x} ${oe.y}`,
    `L ${ie.x} ${ie.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${is.x} ${is.y}`,
    'Z',
  ].join(' ');
}

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const s = polar(cx, cy, r, startAngle);
  const e = polar(cx, cy, r, endAngle);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function layoutAngles() {
  const nominal = Array.from({ length: 12 }, (_, i) => CRITERIA_BY_ID[i + 1].weight);
  const total = nominal.reduce((a, b) => a + b, 0);
  const gap = 1.2;
  const usable = 360 - gap * 12;
  let angle = 0;
  const starts: number[] = [];
  const ends: number[] = [];
  const mids: number[] = [];
  for (let i = 0; i < 12; i++) {
    const sweep = (nominal[i] / total) * usable;
    starts[i] = angle;
    ends[i] = angle + sweep;
    mids[i] = angle + sweep / 2;
    angle = ends[i] + gap;
  }
  return { starts, ends, mids, nominal, total };
}

export function axisGroups() {
  const { starts, ends } = layoutAngles();
  const groups = [
    {
      axis: 'A' as const,
      label: 'A: Feedstock & WEF',
      ids: [0, 1, 2],
      color: AXIS_COLORS.A,
    },
    {
      axis: 'B' as const,
      label: 'B: Process',
      ids: [3, 4, 5, 6],
      color: AXIS_COLORS.B,
    },
    {
      axis: 'C' as const,
      label: 'C: Material & EoL',
      ids: [7, 8, 9, 10, 11],
      color: AXIS_COLORS.C,
    },
  ];
  return groups.map((g) => {
    const start = starts[g.ids[0]];
    const end = ends[g.ids[g.ids.length - 1]];
    const mid = (start + end) / 2;
    const raw = polar(CX, CY, AXIS_LABEL_R, mid);
    // Approximate half-width so upright labels never clip the viewBox.
    const halfW = Math.max(28, g.label.length * 3.35);
    const pad = 6;
    const x = Math.min(VIEW - halfW - pad, Math.max(halfW + pad, raw.x));
    const y = Math.min(VIEW - 12, Math.max(12, raw.y));
    return {
      ...g,
      start,
      end,
      mid,
      labelPos: { x, y },
      textAnchor: 'middle' as const,
    };
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PublicationSvgOptions {
  route: RouteState;
  /** Compared against for ΔS in the hub */
  otherRoute: RouteState;
  routeTitle: string;
  /** Extra vertical space below for the paper legend */
  includeLegend?: boolean;
}

/**
 * Clean publication SVG: pictogram + route title + five paper-defined legend states.
 * Omits web-only chrome (preview labels, unanswered outline legend, tooltips).
 */
export function buildPublicationSvg(options: PublicationSvgOptions): string {
  const { route, otherRoute, routeTitle, includeLegend = true } = options;
  const score = computeGlobalScore(route);
  const other = computeGlobalScore(otherRoute);
  const delta = computeDeltaS(score.score, other.score);
  const { starts, ends, mids } = layoutAngles();
  const axes = axisGroups();

  const hubUnanswered = score.score === null;
  const hubColor = hubUnanswered
    ? '#F1F5F9'
    : scoreToColor(score.score ?? 0, score.allNa ? 'NA' : 'VALID');
  const hubText = contrastTextForScore(
    score.score ?? 0,
    score.allNa ? 'NA' : hubUnanswered ? 'UNANSWERED' : 'VALID',
    { unanswered: hubUnanswered },
  );

  const titleH = 40;
  const legendH = includeLegend ? 36 : 0;
  const height = VIEW + titleH + legendH;

  let sectors = '';
  for (let i = 0; i < 12; i++) {
    const id = i + 1;
    const state = route.criteria[id];
    const evaluated = isCriterionEvaluated(id, state);
    const unanswered = !evaluated;
    const s = resolveCriterionScore(id, state);
    const color = scoreToColor(s ?? 0, state.mode, { unanswered });
    const path = donutSector(CX, CY, INNER, OUTER, starts[i], ends[i]);
    const label = polar(CX, CY, LABEL_R, mids[i]);
    const fillOp = unanswered ? 0.35 : state.mode === 'NA' ? 0.55 : 0.95;
    const stroke = unanswered ? '#CBD5E1' : state.mode === 'NA' ? '#94A3B8' : '#FFFFFF';
    const dash = unanswered || state.mode === 'NA' ? ' stroke-dasharray="4 3"' : '';
    sectors += `<path d="${path}" fill="${color}" fill-opacity="${fillOp}" stroke="${stroke}" stroke-width="${unanswered || state.mode === 'NA' ? 1.75 : 1}"${dash}/>`;
    sectors += `<text x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="#334155" font-size="11" font-weight="600" font-family="IBM Plex Sans, Segoe UI, sans-serif">${id}</text>`;
  }

  let axisMarkup = '';
  for (const a of axes) {
    const tickS0 = polar(CX, CY, AXIS_R - 5, a.start);
    const tickS1 = polar(CX, CY, AXIS_R + 5, a.start);
    const tickE0 = polar(CX, CY, AXIS_R - 5, a.end);
    const tickE1 = polar(CX, CY, AXIS_R + 5, a.end);
    axisMarkup += `<path d="${arcPath(CX, CY, AXIS_R, a.start, a.end)}" fill="none" stroke="${a.color}" stroke-width="7" stroke-linecap="round" opacity="0.95"/>`;
    axisMarkup += `<path d="M ${tickS0.x} ${tickS0.y} L ${tickS1.x} ${tickS1.y}" stroke="${a.color}" stroke-width="3.5" stroke-linecap="round"/>`;
    axisMarkup += `<path d="M ${tickE0.x} ${tickE0.y} L ${tickE1.x} ${tickE1.y}" stroke="${a.color}" stroke-width="3.5" stroke-linecap="round"/>`;
    axisMarkup += `<text x="${a.labelPos.x.toFixed(2)}" y="${a.labelPos.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="${a.color}" font-size="11" font-weight="700" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeXml(a.label)}</text>`;
  }

  const legend = includeLegend
    ? `<g transform="translate(24 ${VIEW + titleH + 8})" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="10" fill="#475569">
        <rect x="0" y="0" width="10" height="10" fill="#15803D" rx="1"/><text x="14" y="9">Green: +0.50 to +1.00</text>
        <rect x="130" y="0" width="10" height="10" fill="#F59E0B" rx="1"/><text x="144" y="9">Yellow: 0.00 to +0.49</text>
        <rect x="270" y="0" width="10" height="10" fill="#B91C1C" rx="1"/><text x="284" y="9">Red: −1.00 to −0.01</text>
        <rect x="0" y="16" width="10" height="10" fill="#E2E8F0" stroke="#94A3B8" rx="1"/><text x="14" y="25">Light Gray: N/A</text>
        <rect x="130" y="16" width="10" height="10" fill="#475569" rx="1"/><text x="144" y="25">Dark Gray: A-NC (−0.25)</text>
      </g>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW}" height="${height}" viewBox="0 0 ${VIEW} ${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="${VIEW / 2}" y="16" text-anchor="middle" fill="#0F172A" font-size="13" font-weight="700" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeXml(routeTitle)}</text>
  <text x="${VIEW / 2}" y="30" text-anchor="middle" fill="#64748B" font-size="9" font-weight="500" font-family="IBM Plex Sans, Segoe UI, sans-serif">BIOGREEN rubric v${BIOGREEN_RUBRIC_VERSION} · ${new Date().toISOString().slice(0, 10)}</text>
  <g transform="translate(0 ${titleH})">
    <rect width="${VIEW}" height="${VIEW}" fill="#FFFFFF"/>
    ${axisMarkup}
    ${sectors}
    <circle cx="${CX}" cy="${CY}" r="${INNER - 4}" fill="${hubColor}"/>
    <circle cx="${CX}" cy="${CY}" r="${INNER - 4}" fill="none" stroke="${hubUnanswered ? '#CBD5E1' : '#FFFFFF'}" stroke-width="3"/>
    <text x="${CX}" y="${CY - 8}" text-anchor="middle" fill="${hubText}" font-size="22" font-weight="700" font-family="IBM Plex Sans, Segoe UI, sans-serif">${formatScore(score.score)}</text>
    <text x="${CX}" y="${CY + 16}" text-anchor="middle" fill="${hubText}" fill-opacity="0.9" font-size="12" font-weight="500" font-family="IBM Plex Sans, Segoe UI, sans-serif">ΔS = ${formatScore(delta)}</text>
  </g>
  ${legend}
</svg>`;
}
