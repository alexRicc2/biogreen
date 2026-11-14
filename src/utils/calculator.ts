import type {
  CriterionMode,
  CriterionResult,
  CriterionState,
  GlobalScoreResult,
  RouteState,
} from '../types/biogreen';
import { CRITERIA_BY_ID } from '../data/criteriaConfig';

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Transport sub-score for Criterion 2.
 * If d <= 0 → +1.00; else clamp(-0.246 * ln(d) + 1.42, -1, +1).
 */
export function scoreTransport(distanceKm: number): number {
  const d = Number.isFinite(distanceKm) ? distanceKm : 0;
  if (d <= 0) return 1.0;
  return clamp(-0.246 * Math.log(d) + 1.42, -1.0, 1.0);
}

/**
 * Water-footprint sub-score for Criterion 2 (L kg⁻¹).
 */
export function scoreWater(waterLkg: number): number {
  const w = Number.isFinite(waterLkg) ? waterLkg : 0;
  if (w < 10) return 1.0;
  if (w <= 100) return 0.5;
  if (w <= 1000) return 0.0;
  return -1.0;
}

/** Combined Criterion 2 score: mean of transport and water sub-scores. */
export function scoreCriterion2(transportKm: number, waterLkg: number): number {
  return (scoreTransport(transportKm) + scoreWater(waterLkg)) / 2;
}

/**
 * E-Factor → discrete score buckets (Criterion 8).
 */
export function scoreEFactor(eFactor: number): number {
  const e = Number.isFinite(eFactor) ? eFactor : Infinity;
  if (e <= 1.0) return 1.0;
  if (e <= 5.0) return 0.5;
  if (e <= 25.0) return 0.0;
  return -1.0;
}

/** Compute E-Factor from waste / product masses. */
export function computeEFactor(wasteMassKg: number, productMassKg: number): number {
  if (!Number.isFinite(wasteMassKg) || !Number.isFinite(productMassKg) || productMassKg <= 0) {
    return Infinity;
  }
  return wasteMassKg / productMassKg;
}

/**
 * A criterion counts as evaluated once the user has explicitly chosen
 * VALID (+ value), N/A, or A-NC. Blank / silent defaults do not count.
 */
export function isCriterionEvaluated(id: number, state: CriterionState): boolean {
  if (state.mode === 'UNANSWERED') return false;
  if (state.mode === 'NA' || state.mode === 'ANC') return true;

  // VALID — require an explicit value
  if (id === 2) {
    return Boolean(
      state.criterion2 &&
        state.criterion2.transportKm !== undefined &&
        state.criterion2.waterFootprintLkg !== undefined &&
        Number.isFinite(state.criterion2.transportKm) &&
        Number.isFinite(state.criterion2.waterFootprintLkg),
    );
  }
  if (id === 8) {
    if (!state.criterion8) return false;
    if (state.criterion8.inputMode === 'masses') {
      return (
        Number.isFinite(state.criterion8.wasteMassKg) &&
        Number.isFinite(state.criterion8.productMassKg) &&
        state.criterion8.productMassKg > 0
      );
    }
    // efactor mode — NaN placeholder means tab selected but no value typed
    return Number.isFinite(state.criterion8.eFactor);
  }
  return state.score !== null;
}

/** Resolve the effective S_i, or null when unanswered / incomplete VALID. */
export function resolveCriterionScore(id: number, state: CriterionState): number | null {
  if (state.mode === 'UNANSWERED') return null;
  if (state.mode === 'ANC') return -0.25;
  if (state.mode === 'NA') return 0;

  if (!isCriterionEvaluated(id, state)) return null;

  if (
    id === 2 &&
    state.criterion2 &&
    state.criterion2.transportKm !== undefined &&
    state.criterion2.waterFootprintLkg !== undefined
  ) {
    return clamp(
      scoreCriterion2(state.criterion2.transportKm, state.criterion2.waterFootprintLkg),
      -1,
      1,
    );
  }

  if (id === 8 && state.criterion8) {
    const e =
      state.criterion8.inputMode === 'masses'
        ? computeEFactor(state.criterion8.wasteMassKg, state.criterion8.productMassKg)
        : state.criterion8.eFactor;
    return scoreEFactor(e);
  }

  if (state.score === null) return null;
  return clamp(state.score, -1, 1);
}

/**
 * Effective weight in the global formula.
 * N/A and unanswered / incomplete VALID contribute 0.
 */
export function resolveEffectiveWeight(
  id: number,
  state: CriterionState,
  pillarWeight: number,
): number {
  if (state.mode === 'NA' || state.mode === 'UNANSWERED') return 0;
  if (state.mode === 'ANC') return pillarWeight;
  if (!isCriterionEvaluated(id, state)) return 0;
  return pillarWeight;
}

/**
 * Global BIOGREEN score:
 *   S_global = Σ(S_i · W_i) / Σ(W_i)  over evaluated non-N/A criteria.
 * Returns score=null when nothing contributes yet (blank / all unanswered).
 * Returns 0.00 with allNa=true if every evaluated criterion is N/A.
 */
export function computeGlobalScore(route: RouteState): GlobalScoreResult {
  const results: CriterionResult[] = [];
  let numerator = 0;
  let denominator = 0;
  let evaluatedCount = 0;
  let naCount = 0;

  for (let id = 1; id <= 12; id++) {
    const def = CRITERIA_BY_ID[id];
    const state = route.criteria[id];
    const evaluated = isCriterionEvaluated(id, state);
    if (evaluated) evaluatedCount += 1;
    if (state.mode === 'NA') naCount += 1;

    const score = resolveCriterionScore(id, state);
    const effectiveWeight = resolveEffectiveWeight(id, state, def.weight);
    const contribution = score === null ? 0 : score * effectiveWeight;

    results.push({
      id,
      mode: state.mode,
      score,
      weight: def.weight,
      effectiveWeight,
      contribution,
      evaluated,
    });

    numerator += contribution;
    denominator += effectiveWeight;
  }

  if (denominator === 0) {
    const allNa = evaluatedCount > 0 && naCount === evaluatedCount;
    return {
      score: allNa ? 0 : null,
      totalWeight: 0,
      allNa,
      incomplete: !allNa,
      evaluatedCount,
      results,
    };
  }

  return {
    score: numerator / denominator,
    totalWeight: denominator,
    allNa: false,
    incomplete: evaluatedCount < 12,
    evaluatedCount,
    results,
  };
}

/** ΔS = S_proposed − S_baseline (null if either side lacks a score) */
export function computeDeltaS(
  proposed: number | null,
  baseline: number | null,
): number | null {
  if (proposed === null || baseline === null) return null;
  return proposed - baseline;
}

/** Format a score with explicit sign and two decimal places. */
export function formatScore(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(digits)}`;
}

export function countEvaluated(route: RouteState): number {
  let n = 0;
  for (let id = 1; id <= 12; id++) {
    if (isCriterionEvaluated(id, route.criteria[id])) n += 1;
  }
  return n;
}

export function modeLabel(mode: CriterionMode): string {
  if (mode === 'ANC') return 'A-NC';
  if (mode === 'NA') return 'N/A';
  if (mode === 'UNANSWERED') return 'Unanswered';
  return 'VALID';
}
