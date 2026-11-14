import type { CriterionMode } from '../types/biogreen';

/** Traffic-light colour mapping from manuscript Section 3.3.4 */
export function scoreToColor(
  score: number,
  mode: CriterionMode,
  options?: { unanswered?: boolean },
): string {
  if (options?.unanswered || mode === 'UNANSWERED') return '#FFFFFF';
  if (mode === 'NA') return '#E2E8F0';
  if (mode === 'ANC') return '#475569';

  if (score >= 0.5) {
    const t = (score - 0.5) / 0.5;
    return lerpHex('#4ADE80', '#15803D', t);
  }
  if (score >= 0) {
    const t = score / 0.49;
    return lerpHex('#F59E0B', '#A3E635', Math.min(1, t));
  }
  const t = (score + 1) / 0.99;
  return lerpHex('#B91C1C', '#F87171', Math.min(1, Math.max(0, t)));
}

/**
 * Hub / badge text color for readability on traffic-light fills.
 * Dark slate on amber/yellow/light-green (-0.15 … +0.65); white on deep crimson/emerald.
 */
export function contrastTextForScore(
  score: number,
  mode: CriterionMode,
  options?: { unanswered?: boolean },
): string {
  if (options?.unanswered || mode === 'UNANSWERED' || mode === 'NA') return '#0F172A';
  if (mode === 'ANC') return '#FFFFFF';
  if (score > 0.65 || score < -0.15) return '#FFFFFF';
  return '#0F172A';
}

export function lerpHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
