import type { EvaluationState, ExportPayload, RouteState } from '../types/biogreen';
import { CRITERIA_BY_ID } from '../data/criteriaConfig';
import {
  computeDeltaS,
  computeGlobalScore,
  formatScore,
  resolveCriterionScore,
} from './calculator';
import { buildPublicationSvg } from './pictogramSvg';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface PictogramExportContext {
  route: RouteState;
  otherRoute: RouteState;
  routeTitle: string;
}

/** Download a clean publication SVG (no web-only chrome). */
export function exportSvg(
  ctx: PictogramExportContext,
  filename = 'biogreen-pictogram.svg',
): void {
  const source = buildPublicationSvg({
    route: ctx.route,
    otherRoute: ctx.otherRoute,
    routeTitle: ctx.routeTitle,
    includeLegend: true,
  });
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Rasterize the clean publication SVG to a 300-DPI PNG.
 * Target print size ≈ 4.2 inches square → ~1260 px at 300 DPI (matches viewBox).
 */
export async function exportPng(
  ctx: PictogramExportContext,
  filename = 'biogreen-pictogram-300dpi.png',
  dpi = 300,
): Promise<void> {
  const source = buildPublicationSvg({
    route: ctx.route,
    otherRoute: ctx.otherRoute,
    routeTitle: ctx.routeTitle,
    includeLegend: true,
  });

  // Parse viewBox height from generated SVG
  const match = source.match(/viewBox="0 0 (\d+) (\d+)"/);
  const vbW = match ? Number(match[1]) : 420;
  const vbH = match ? Number(match[2]) : 484;
  const width = Math.round((dpi * vbW) / 100); // ~4.2" at 100 user units per inch feel
  const height = Math.round((width * vbH) / vbW);

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new Error('Canvas 2D context unavailable');
    ctx2d.fillStyle = '#FFFFFF';
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))),
        'image/png',
      );
    });
    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG for rasterization'));
    img.src = url;
  });
}

/** Serialize the full evaluation to a downloadable JSON file. */
export function exportJson(evaluation: EvaluationState, filename = 'biogreen-evaluation.json'): void {
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    evaluation,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  downloadBlob(blob, filename);
}

/** Parse an imported JSON evaluation payload. */
export function importJson(text: string): EvaluationState {
  const data = JSON.parse(text) as ExportPayload | EvaluationState;
  if ('evaluation' in data && data.evaluation) {
    return data.evaluation;
  }
  if ('proposed' in data && 'baseline' in data) {
    return data as EvaluationState;
  }
  throw new Error('Unrecognized BIOGREEN JSON format');
}

/** Open a printable multi-criterion PDF/report in a new window. */
export function exportPdfReport(evaluation: EvaluationState): void {
  const proposed = computeGlobalScore(evaluation.proposed);
  const baseline = computeGlobalScore(evaluation.baseline);
  const delta = computeDeltaS(proposed.score, baseline.score);

  const rows = Array.from({ length: 12 }, (_, i) => {
    const id = i + 1;
    const def = CRITERIA_BY_ID[id];
    const pState = evaluation.proposed.criteria[id];
    const bState = evaluation.baseline.criteria[id];
    const pScore = resolveCriterionScore(id, pState);
    const bScore = resolveCriterionScore(id, bState);
    return `
      <tr>
        <td>${id}</td>
        <td>${escapeHtml(def.title)}</td>
        <td>${def.weight.toFixed(1)}</td>
        <td>${pState.mode}</td>
        <td class="num">${formatScore(pScore)}</td>
        <td>${escapeHtml(pState.justification || '—')}</td>
        <td>${bState.mode}</td>
        <td class="num">${formatScore(bScore)}</td>
        <td>${escapeHtml(bState.justification || '—')}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BIOGREEN Report — ${escapeHtml(evaluation.projectTitle)}</title>
  <style>
    @page { margin: 1.5cm; }
    body { font-family: "IBM Plex Sans", "Segoe UI", sans-serif; color: #0F172A; font-size: 11pt; }
    h1 { font-size: 18pt; margin: 0 0 0.25rem; }
    .meta { color: #64748B; margin-bottom: 1.25rem; }
    .kpis { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
    .kpi { border: 1px solid #E2E8F0; border-radius: 8px; padding: 0.75rem 1rem; min-width: 8rem; }
    .kpi .label { font-size: 9pt; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi .value { font-variant-numeric: tabular-nums; font-size: 16pt; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #E2E8F0; padding: 0.35rem 0.45rem; vertical-align: top; }
    th { background: #F8FAFC; text-align: left; }
    .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:1rem;padding:0.5rem 1rem;">Print / Save as PDF</button>
  <h1>BIOGREEN Assessment Report</h1>
  <p class="meta">${escapeHtml(evaluation.projectTitle)} · Generated ${new Date().toLocaleString()}</p>
  <div class="kpis">
    <div class="kpi"><div class="label">S<sub>proposed</sub></div><div class="value">${formatScore(proposed.score)}</div></div>
    <div class="kpi"><div class="label">S<sub>baseline</sub></div><div class="value">${formatScore(baseline.score)}</div></div>
    <div class="kpi"><div class="label">ΔS</div><div class="value">${formatScore(delta)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Criterion</th><th>W</th>
        <th>Proposed mode</th><th>S<sub>p</sub></th><th>Proposed note</th>
        <th>Baseline mode</th><th>S<sub>b</sub></th><th>Baseline note</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, 'biogreen-report.html');
    return;
  }
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
