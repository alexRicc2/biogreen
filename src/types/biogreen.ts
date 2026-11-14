/** Criterion status modes — UNANSWERED is a UI guard so blank forms never invent scores */
export type CriterionMode = 'UNANSWERED' | 'VALID' | 'NA' | 'ANC';

export type AxisId = 'A' | 'B' | 'C';

export interface AnchorOption {
  score: number;
  label: string;
}

/** Dual quantitative inputs for Criterion 2 — both fields required to evaluate */
export interface Criterion2Extras {
  transportKm?: number;
  waterFootprintLkg?: number;
}

/** Mass-efficiency helper for Criterion 8 */
export interface Criterion8Extras {
  inputMode: 'efactor' | 'masses';
  eFactor: number;
  wasteMassKg: number;
  productMassKg: number;
}

export interface CriterionState {
  mode: CriterionMode;
  /**
   * Selected or custom score in [-1, +1].
   * `null` means no categorical/custom value has been chosen yet.
   */
  score: number | null;
  /** Free-text justification / reference note */
  justification: string;
  /** True when user overrides categorical anchors with the custom slider */
  useCustomScore: boolean;
  criterion2?: Criterion2Extras;
  criterion8?: Criterion8Extras;
}

export interface CriterionDefinition {
  id: number;
  key: string;
  title: string;
  axis: AxisId;
  axisLabel: string;
  weight: number;
  pillar: 'Environmental' | 'Social' | 'Economic';
  description: string;
  inputType: 'categorical' | 'dual_quantitative' | 'efactor';
  anchors: AnchorOption[];
}

export interface RouteState {
  label: string;
  criteria: Record<number, CriterionState>;
}

export interface EvaluationState {
  projectTitle: string;
  proposed: RouteState;
  baseline: RouteState;
}

export interface CriterionResult {
  id: number;
  mode: CriterionMode;
  score: number | null;
  weight: number;
  effectiveWeight: number;
  contribution: number;
  evaluated: boolean;
}

export interface GlobalScoreResult {
  score: number | null;
  totalWeight: number;
  allNa: boolean;
  /** True when no criterion contributes (all unanswered and/or N/A) */
  incomplete: boolean;
  evaluatedCount: number;
  results: CriterionResult[];
}

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  evaluation: EvaluationState;
}

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  evaluation: EvaluationState;
}
