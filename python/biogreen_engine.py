#!/usr/bin/env python3
"""
BIOGREEN reference scoring engine (Supporting Information).

Self-contained, standard-library-only implementation of the quantitative
green chemistry metric described in the BIOGREEN manuscript (Section 3.3).

Usage as a library:
    from biogreen_engine import CriterionInput, score_route, delta_s

Usage from CLI:
    python biogreen_engine.py
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Literal, Optional, Tuple

Mode = Literal["VALID", "NA", "ANC", "UNANSWERED"]

# Fixed pillar weights W_i for criteria 1..12
WEIGHTS: Dict[int, float] = {
    1: 3.0,
    2: 2.0,
    3: 3.0,
    4: 3.0,
    5: 3.0,
    6: 2.0,
    7: 1.0,
    8: 3.0,
    9: 3.0,
    10: 2.0,
    11: 3.0,
    12: 1.0,
}

ANC_PENALTY = -0.25


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def score_transport(distance_km: float) -> float:
    """Transport sub-score for Criterion 2."""
    if distance_km <= 0:
        return 1.0
    return clamp(-0.246 * math.log(distance_km) + 1.42)


def score_water(water_l_per_kg: float) -> float:
    """Water-footprint sub-score for Criterion 2."""
    if water_l_per_kg < 10:
        return 1.0
    if water_l_per_kg <= 100:
        return 0.5
    if water_l_per_kg <= 1000:
        return 0.0
    return -1.0


def score_criterion_2(distance_km: float, water_l_per_kg: float) -> float:
    return (score_transport(distance_km) + score_water(water_l_per_kg)) / 2.0


def score_efactor(e_factor: float) -> float:
    """Map E-Factor to discrete Criterion 8 score."""
    if e_factor <= 1.0:
        return 1.0
    if e_factor <= 5.0:
        return 0.5
    if e_factor <= 25.0:
        return 0.0
    return -1.0


def compute_efactor(waste_mass_kg: float, product_mass_kg: float) -> float:
    if product_mass_kg <= 0:
        raise ValueError("product_mass_kg must be > 0")
    return waste_mass_kg / product_mass_kg


@dataclass
class CriterionInput:
    """Input for a single BIOGREEN criterion."""

    mode: Mode = "VALID"
    score: float = 0.0
    # Criterion 2 extras
    transport_km: Optional[float] = None
    water_l_per_kg: Optional[float] = None
    # Criterion 8 extras
    e_factor: Optional[float] = None
    waste_mass_kg: Optional[float] = None
    product_mass_kg: Optional[float] = None


@dataclass
class CriterionResult:
    criterion_id: int
    mode: Mode
    score: float
    weight: float
    effective_weight: float
    contribution: float


@dataclass
class RouteResult:
    global_score: float
    total_weight: float
    all_na: bool
    criteria: List[CriterionResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "global_score": self.global_score,
            "total_weight": self.total_weight,
            "all_na": self.all_na,
            "criteria": [asdict(c) for c in self.criteria],
        }


def resolve_score(criterion_id: int, inp: CriterionInput) -> Optional[float]:
    """Resolve effective S_i given mode and optional quantitative helpers."""
    if inp.mode == "UNANSWERED":
        return None
    if inp.mode == "ANC":
        return ANC_PENALTY
    if inp.mode == "NA":
        return 0.0

    if criterion_id == 2 and inp.transport_km is not None and inp.water_l_per_kg is not None:
        return clamp(score_criterion_2(inp.transport_km, inp.water_l_per_kg))

    if criterion_id == 8:
        if inp.waste_mass_kg is not None and inp.product_mass_kg is not None:
            e = compute_efactor(inp.waste_mass_kg, inp.product_mass_kg)
            return score_efactor(e)
        if inp.e_factor is not None:
            return score_efactor(inp.e_factor)

    return clamp(float(inp.score))


def score_route(criteria: Dict[int, CriterionInput]) -> RouteResult:
    """
    Compute S_global = Σ(S_i · W_i) / Σ(W_i) over evaluated non-N/A criteria.

    UNANSWERED criteria are excluded from both numerator and denominator.
    If all 12 criteria are N/A, returns global_score=0.0 with all_na=True.
    If nothing contributes yet (all unanswered), returns global_score=0.0 with all_na=False.
    Missing criterion ids default to VALID with score 0.0.
    """
    results: List[CriterionResult] = []
    numerator = 0.0
    denominator = 0.0

    for cid in range(1, 13):
        inp = criteria.get(cid, CriterionInput())
        weight = WEIGHTS[cid]
        score = resolve_score(cid, inp)
        if inp.mode in ("NA", "UNANSWERED") or score is None:
            effective_weight = 0.0
            contribution = 0.0
            display_score = 0.0 if score is None else score
        else:
            effective_weight = weight
            contribution = score * effective_weight
            display_score = score

        results.append(
            CriterionResult(
                criterion_id=cid,
                mode=inp.mode,
                score=display_score,
                weight=weight,
                effective_weight=effective_weight,
                contribution=contribution,
            )
        )
        numerator += contribution
        denominator += effective_weight

    if denominator == 0.0:
        all_na = all(
            criteria.get(i, CriterionInput()).mode == "NA" for i in range(1, 13)
        )
        return RouteResult(global_score=0.0, total_weight=0.0, all_na=all_na, criteria=results)

    return RouteResult(
        global_score=numerator / denominator,
        total_weight=denominator,
        all_na=False,
        criteria=results,
    )


def delta_s(proposed: float, baseline: float) -> float:
    """ΔS = S_proposed − S_baseline."""
    return proposed - baseline


def compare_routes(
    proposed: Dict[int, CriterionInput],
    baseline: Dict[int, CriterionInput],
) -> Tuple[RouteResult, RouteResult, float]:
    p = score_route(proposed)
    b = score_route(baseline)
    return p, b, delta_s(p.global_score, b.global_score)


def _demo() -> None:
    proposed = {
        1: CriterionInput(mode="VALID", score=1.0),
        2: CriterionInput(mode="VALID", transport_km=80.0, water_l_per_kg=40.0),
        3: CriterionInput(mode="VALID", score=0.75),
        4: CriterionInput(mode="VALID", score=1.0),
        5: CriterionInput(mode="VALID", score=0.5),
        6: CriterionInput(mode="VALID", score=0.5),
        7: CriterionInput(mode="VALID", score=0.0),
        8: CriterionInput(mode="VALID", e_factor=2.5),
        9: CriterionInput(mode="VALID", score=1.0),
        10: CriterionInput(mode="VALID", score=1.0),
        11: CriterionInput(mode="VALID", score=1.0),
        12: CriterionInput(mode="VALID", score=0.5),
    }
    baseline = {
        1: CriterionInput(mode="VALID", score=-1.0),
        2: CriterionInput(mode="VALID", transport_km=1200.0, water_l_per_kg=1500.0),
        3: CriterionInput(mode="VALID", score=-1.0),
        4: CriterionInput(mode="VALID", score=-1.0),
        5: CriterionInput(mode="VALID", score=-1.0),
        6: CriterionInput(mode="VALID", score=-1.0),
        7: CriterionInput(mode="VALID", score=-1.0),
        8: CriterionInput(mode="VALID", e_factor=40.0),
        9: CriterionInput(mode="VALID", score=0.0),
        10: CriterionInput(mode="VALID", score=0.0),
        11: CriterionInput(mode="VALID", score=-1.0),
        12: CriterionInput(mode="VALID", score=-1.0),
    }
    p, b, d = compare_routes(proposed, baseline)
    print(
        json.dumps(
            {
                "S_proposed": round(p.global_score, 4),
                "S_baseline": round(b.global_score, 4),
                "delta_S": round(d, 4),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    _demo()
