import type {
  CriterionDefinition,
  CriterionState,
  EvaluationState,
  PresetDefinition,
  RouteState,
} from '../types/biogreen';

export const CRITERIA: CriterionDefinition[] = [
  {
    id: 1,
    key: 'feedstock_origin',
    title: 'Feedstock origin and land-use conflict',
    axis: 'A',
    axisLabel: 'Axis A: Feedstock & WEF Nexus',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Origin of biomass feedstock and associated land-use conflicts.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Real agricultural, forestry, or industrial waste/passives' },
      { score: 0.75, label: 'Non-terrestrial (algae) or invasive/exotic species' },
      { score: 0.25, label: 'Smallholder polyculture/sustainable farming' },
      { score: -0.75, label: 'Intensive monoculture biomass' },
      { score: -1.0, label: 'Dedicated food crops or destructive wild harvesting' },
    ],
  },
  {
    id: 2,
    key: 'water_transport',
    title: 'Water footprint and transport logistics',
    axis: 'A',
    axisLabel: 'Axis A: Feedstock & WEF Nexus',
    weight: 2.0,
    pillar: 'Social',
    description: 'Combined transport distance and water footprint of feedstock logistics.',
    inputType: 'dual_quantitative',
    anchors: [],
  },
  {
    id: 3,
    key: 'pretreatment',
    title: 'Biomass pretreatment burden',
    axis: 'A',
    axisLabel: 'Axis A: Feedstock & WEF Nexus',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Intensity of biomass pretreatment required before conversion.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Zero pretreatment required' },
      { score: 0.75, label: 'Physical/mechanical methods only (milling, solar drying)' },
      { score: 0.5, label: 'Biological/enzymatic or mild green chemical treatment' },
      { score: 0.0, label: 'Moderate chemical treatment' },
      { score: -0.75, label: 'Concentrated strong acids/bases' },
      { score: -1.0, label: 'High-temperature calcination or energy-intensive oven drying (> 12 h)' },
    ],
  },
  {
    id: 4,
    key: 'solvent',
    title: 'Solvent selection and reaction media',
    axis: 'B',
    axisLabel: 'Axis B: Reaction & Process',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Greenness of solvents and reaction media.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Solvent-free or water-only media' },
      { score: 0.5, label: 'Recommended green solvents (ethanol, glycerol, bio-DES, DMC)' },
      { score: 0.0, label: 'Problematic solvents (acetone, THF, toluene)' },
      { score: -1.0, label: 'Hazardous/restricted solvents (DMF, DMAC, NMP, CHCl₃, DCM)' },
    ],
  },
  {
    id: 5,
    key: 'energy',
    title: 'Energy efficiency and grid origin',
    axis: 'B',
    axisLabel: 'Axis B: Reaction & Process',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Process energy demand and electricity/heat source.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Ambient temperature (25 °C) or direct solar thermal/photovoltaic energy' },
      {
        score: 0.5,
        label: 'Intensified methods (microwaves, mechanochemistry, ultrasound) powered by 100% renewable grid',
      },
      { score: 0.0, label: 'Mild heating (≤ 120 °C) using high-consumption equipment' },
      {
        score: -1.0,
        label: 'High-temperature pyrolysis/activation (> 400 °C for > 4 h) on fossil-heavy grid',
      },
    ],
  },
  {
    id: 6,
    key: 'auxiliaries',
    title: 'Auxiliaries, catalysts and reagents',
    axis: 'B',
    axisLabel: 'Axis B: Reaction & Process',
    weight: 2.0,
    pillar: 'Social',
    description: 'Toxicity, recoverability, and origin of catalysts and reagents.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Biocatalysts or recyclable bio-derived heterogeneous catalysts and reagents' },
      { score: 0.5, label: 'Low-toxicity recyclable synthetic heterogeneous catalysts and reagents' },
      { score: -0.5, label: 'Unrecoverable homogeneous catalysts and reagents' },
      {
        score: -1.0,
        label: 'Toxic heavy metals, corrosive activators (KOH, ZnCl₂), or excessive stoichiometric reagents without recovery',
      },
    ],
  },
  {
    id: 7,
    key: 'scalability',
    title: 'Process scalability and mode of operation',
    axis: 'B',
    axisLabel: 'Axis B: Reaction & Process',
    weight: 1.0,
    pillar: 'Economic',
    description: 'Batch vs continuous operation and reproducibility at scale.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Continuous-flow, automated, highly reproducible process' },
      { score: 0.5, label: 'Semi-continuous flow' },
      { score: 0.0, label: 'Fast batch process with short reaction times' },
      { score: -1.0, label: 'Slow, non-reproducible multi-step batch process' },
    ],
  },
  {
    id: 8,
    key: 'efactor',
    title: 'Mass efficiency metrics (E-Factor)',
    axis: 'C',
    axisLabel: 'Axis C: Material Performance & End-of-Life',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Process mass efficiency expressed as E-Factor (waste / product).',
    inputType: 'efactor',
    anchors: [
      { score: 1.0, label: 'E-factor ≤ 1.0' },
      { score: 0.5, label: '1.1 ≤ E-factor ≤ 5.0' },
      { score: 0.0, label: '5.1 ≤ E-factor ≤ 25.0' },
      { score: -1.0, label: 'E-factor > 25.0' },
    ],
  },
  {
    id: 9,
    key: 'stability',
    title: 'Application stability and leaching liabilities',
    axis: 'C',
    axisLabel: 'Axis C: Material Performance & End-of-Life',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Reuse cycles, performance retention, and contaminant leaching.',
    inputType: 'categorical',
    anchors: [
      {
        score: 1.0,
        label: 'Stable performance over ≥ 5 reuse cycles with zero detectable contaminant leaching',
      },
      { score: 0.0, label: 'Slight performance drop (≤ 10%) or vestigial leaching (≤ 5%)' },
      {
        score: -1.0,
        label:
          'Structural breakdown, severe leaching (metal ions, organic carbon), or regeneration requiring concentrated acid/base washing',
      },
    ],
  },
  {
    id: 10,
    key: 'safety',
    title: 'Material safety and ecotoxicity',
    axis: 'C',
    axisLabel: 'Axis C: Material Performance & End-of-Life',
    weight: 2.0,
    pillar: 'Social',
    description: 'Human and environmental hazard profile of the material.',
    inputType: 'categorical',
    anchors: [
      { score: 1.0, label: 'Non-toxic, non-flammable, bio-compatible, non-bioaccumulative' },
      { score: 0.0, label: 'Mild controllable handling hazards' },
      { score: -1.0, label: 'High aquatic/terrestrial ecotoxicity, carcinogenic, or mutagenic risks' },
    ],
  },
  {
    id: 11,
    key: 'eol',
    title: 'Design for degradation and end-of-life',
    axis: 'C',
    axisLabel: 'Axis C: Material Performance & End-of-Life',
    weight: 3.0,
    pillar: 'Environmental',
    description: 'Biodegradability and closed-loop recyclability at end of life.',
    inputType: 'categorical',
    anchors: [
      {
        score: 1.0,
        label: 'Fully biodegradable in natural soil/water or 100% closed-loop monomer chemical recycling',
      },
      { score: 0.0, label: 'Partially degradable' },
      {
        score: -1.0,
        label: 'Recalcitrant, microplastic-generating, or toxic residue persistent in nature',
      },
    ],
  },
  {
    id: 12,
    key: 'effluent',
    title: 'Effluent management and biorefinery integration',
    axis: 'C',
    axisLabel: 'Axis C: Material Performance & End-of-Life',
    weight: 1.0,
    pillar: 'Economic',
    description: 'Treatment of process effluents and integration into biorefinery loops.',
    inputType: 'categorical',
    anchors: [
      {
        score: 1.0,
        label: 'Fully integrated zero-waste biorefinery (effluents serve as feedstocks for secondary cycles)',
      },
      { score: 0.5, label: 'Readily biodegradable effluents treated via standard municipal systems' },
      { score: 0.0, label: 'Effluents requiring complex advanced oxidation' },
      { score: -1.0, label: 'Untreated hazardous effluent discharge' },
    ],
  },
];

export const CRITERIA_BY_ID: Record<number, CriterionDefinition> = Object.fromEntries(
  CRITERIA.map((c) => [c.id, c]),
) as Record<number, CriterionDefinition>;

export const AXIS_GROUPS: { axis: 'A' | 'B' | 'C'; label: string; ids: number[] }[] = [
  { axis: 'A', label: 'Axis A: Feedstock & WEF Nexus', ids: [1, 2, 3] },
  { axis: 'B', label: 'Axis B: Reaction & Process', ids: [4, 5, 6, 7] },
  { axis: 'C', label: 'Axis C: Material Performance & End-of-Life', ids: [8, 9, 10, 11, 12] },
];

/** Blank / Reset default: explicitly unanswered — never invent silent scores. */
function defaultCriterionState(_id: number): CriterionState {
  return {
    mode: 'UNANSWERED',
    score: null,
    justification: '',
    useCustomScore: false,
  };
}

export function createEmptyRoute(label: string): RouteState {
  const criteria: Record<number, CriterionState> = {};
  for (let id = 1; id <= 12; id++) {
    criteria[id] = defaultCriterionState(id);
  }
  return { label, criteria };
}

export function createEmptyEvaluation(): EvaluationState {
  return {
    projectTitle: 'Untitled BIOGREEN Evaluation',
    proposed: createEmptyRoute('Proposed Synthesis'),
    baseline: createEmptyRoute('Baseline Reference'),
  };
}

function cloneState(state: CriterionState): CriterionState {
  return structuredClone(state);
}

function routeFromScores(
  label: string,
  scores: Partial<Record<number, Partial<CriterionState>>>,
): RouteState {
  const route = createEmptyRoute(label);
  for (const [idStr, partial] of Object.entries(scores)) {
    const id = Number(idStr);
    const merged = {
      ...route.criteria[id],
      ...cloneState(partial as CriterionState),
    };
    // Preset entries are fully specified evaluations
    if (merged.mode === 'UNANSWERED') merged.mode = 'VALID';
    route.criteria[id] = merged;
  }
  return route;
}

/**
 * Built-in demo presets for UI walkthroughs.
 *
 * These are illustrative rubric-based scenarios (not scored tables from the
 * manuscript). Section 3.3.5 "BIOGREEN validation" is still empty in the
 * current draft, so replace these with real paper case studies when available.
 */
export const PRESETS: PresetDefinition[] = [
  {
    id: 'blank',
    name: 'Blank evaluation',
    description: 'All 12 criteria unanswered — no silent default scores.',
    evaluation: createEmptyEvaluation(),
  },
  {
    id: 'lignocellulosic_adsorbent',
    name: 'Demo: lignocellulosic adsorbent vs activated carbon',
    description:
      'Illustrative demo (not a paper table). Proposed: agricultural-residue bioadsorbent. Baseline: commercial fossil-derived activated carbon.',
    evaluation: {
      projectTitle: 'Lignocellulosic Waste Adsorbent vs Commercial Activated Carbon',
      proposed: routeFromScores('Proposed Synthesis', {
        1: { mode: 'VALID', score: 1.0, justification: 'Rice-husk agricultural waste feedstock' },
        2: {
          mode: 'VALID',
          score: 0.5,
          criterion2: { transportKm: 80, waterFootprintLkg: 40 },
          justification: 'Regional residue collection; low process water',
        },
        3: { mode: 'VALID', score: 0.75, justification: 'Milling and solar drying only' },
        4: { mode: 'VALID', score: 1.0, justification: 'Water-only media' },
        5: { mode: 'VALID', score: 0.5, justification: 'Microwave activation on renewable grid' },
        6: { mode: 'VALID', score: 0.5, justification: 'Recyclable heterogeneous catalyst' },
        7: { mode: 'VALID', score: 0.0, justification: 'Fast batch process' },
        8: {
          mode: 'VALID',
          score: 0.5,
          criterion8: { inputMode: 'efactor', eFactor: 2.5, wasteMassKg: 2.5, productMassKg: 1 },
        },
        9: { mode: 'VALID', score: 1.0, justification: '≥ 5 reuse cycles, no detectable leaching' },
        10: { mode: 'VALID', score: 1.0, justification: 'Non-toxic bio-compatible material' },
        11: { mode: 'VALID', score: 1.0, justification: 'Fully biodegradable in soil' },
        12: { mode: 'VALID', score: 0.5, justification: 'Biodegradable effluent to municipal treatment' },
      }),
      baseline: routeFromScores('Baseline Reference', {
        1: { mode: 'VALID', score: -1.0, justification: 'Fossil coal / petroleum coke precursor' },
        2: {
          mode: 'VALID',
          score: -0.5,
          criterion2: { transportKm: 1200, waterFootprintLkg: 1500 },
          justification: 'Long-haul logistics; high process water',
        },
        3: { mode: 'VALID', score: -1.0, justification: 'High-temperature calcination' },
        4: { mode: 'VALID', score: -1.0, justification: 'Hazardous activation media' },
        5: { mode: 'VALID', score: -1.0, justification: 'Pyrolysis > 400 °C on fossil grid' },
        6: { mode: 'VALID', score: -1.0, justification: 'KOH / ZnCl₂ activators without recovery' },
        7: { mode: 'VALID', score: -1.0, justification: 'Slow multi-step batch' },
        8: {
          mode: 'VALID',
          score: -1.0,
          criterion8: { inputMode: 'efactor', eFactor: 40, wasteMassKg: 40, productMassKg: 1 },
        },
        9: { mode: 'VALID', score: 0.0, justification: 'Mild performance drop on reuse' },
        10: { mode: 'VALID', score: 0.0, justification: 'Mild handling hazards' },
        11: { mode: 'VALID', score: -1.0, justification: 'Recalcitrant carbon residue' },
        12: { mode: 'VALID', score: -1.0, justification: 'Hazardous alkaline effluent' },
      }),
    },
  },
  {
    id: 'algal_biopolymer',
    name: 'Demo: algal biopolymer vs petrochemical plastic',
    description:
      'Illustrative demo (not a paper table). Proposed: invasive-algae biopolymer. Baseline: virgin petrochemical plastic resin.',
    evaluation: {
      projectTitle: 'Algal Biopolymer vs Virgin Petrochemical Plastic',
      proposed: routeFromScores('Proposed Synthesis', {
        1: { mode: 'VALID', score: 0.75, justification: 'Invasive algal biomass' },
        2: {
          mode: 'VALID',
          score: 0.75,
          criterion2: { transportKm: 25, waterFootprintLkg: 8 },
          justification: 'Near-shore harvest; low freshwater demand',
        },
        3: { mode: 'VALID', score: 0.5, justification: 'Enzymatic mild pretreatment' },
        4: { mode: 'VALID', score: 0.5, justification: 'Ethanol / bio-DES media' },
        5: { mode: 'VALID', score: 1.0, justification: 'Ambient / solar-assisted processing' },
        6: { mode: 'VALID', score: 1.0, justification: 'Biocatalysts' },
        7: { mode: 'VALID', score: 0.5, justification: 'Semi-continuous flow' },
        8: {
          mode: 'VALID',
          score: 1.0,
          criterion8: { inputMode: 'efactor', eFactor: 0.8, wasteMassKg: 0.8, productMassKg: 1 },
        },
        9: { mode: 'VALID', score: 0.0, justification: 'Slight performance drop on reuse' },
        10: { mode: 'VALID', score: 1.0 },
        11: { mode: 'VALID', score: 1.0, justification: 'Fully biodegradable' },
        12: { mode: 'VALID', score: 1.0, justification: 'Zero-waste biorefinery integration' },
      }),
      baseline: routeFromScores('Baseline Reference', {
        1: { mode: 'VALID', score: -1.0, justification: 'Fossil feedstock' },
        2: {
          mode: 'VALID',
          score: -0.25,
          criterion2: { transportKm: 800, waterFootprintLkg: 200 },
        },
        3: { mode: 'ANC', score: -0.25, justification: 'Pretreatment data unreported in source' },
        4: { mode: 'VALID', score: -1.0, justification: 'Chlorinated / DMF process solvents' },
        5: { mode: 'VALID', score: -1.0 },
        6: { mode: 'VALID', score: -0.5 },
        7: { mode: 'VALID', score: 1.0, justification: 'Mature continuous petrochemical plant' },
        8: {
          mode: 'VALID',
          score: 0.0,
          criterion8: { inputMode: 'efactor', eFactor: 12, wasteMassKg: 12, productMassKg: 1 },
        },
        9: { mode: 'VALID', score: 1.0 },
        10: { mode: 'VALID', score: -1.0, justification: 'Known aquatic ecotoxicity concerns' },
        11: { mode: 'VALID', score: -1.0, justification: 'Microplastic-generating' },
        12: { mode: 'VALID', score: 0.0 },
      }),
    },
  },
];

export const WATER_TIERS = [
  { max: 9.999, label: '< 10 L kg⁻¹', score: 1.0, value: 5 },
  { max: 100, label: '10–100 L kg⁻¹', score: 0.5, value: 50 },
  { max: 1000, label: '101–1000 L kg⁻¹', score: 0.0, value: 500 },
  { max: Infinity, label: '> 1000 L kg⁻¹', score: -1.0, value: 2000 },
];
