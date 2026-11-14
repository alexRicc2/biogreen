#!/usr/bin/env python3
"""Unit tests for the BIOGREEN reference engine (stdlib unittest)."""

from __future__ import annotations

import math
import unittest

from biogreen_engine import (
    ANC_PENALTY,
    CriterionInput,
    clamp,
    compare_routes,
    compute_efactor,
    delta_s,
    score_criterion_2,
    score_efactor,
    score_route,
    score_transport,
    score_water,
)


class TestHelpers(unittest.TestCase):
    def test_clamp(self) -> None:
        self.assertEqual(clamp(2.0), 1.0)
        self.assertEqual(clamp(-2.0), -1.0)
        self.assertEqual(clamp(0.3), 0.3)

    def test_transport_zero_and_positive(self) -> None:
        self.assertEqual(score_transport(0), 1.0)
        self.assertEqual(score_transport(-5), 1.0)
        expected = clamp(-0.246 * math.log(100) + 1.42)
        self.assertAlmostEqual(score_transport(100), expected, places=6)

    def test_water_tiers(self) -> None:
        self.assertEqual(score_water(5), 1.0)
        self.assertEqual(score_water(10), 0.5)
        self.assertEqual(score_water(100), 0.5)
        self.assertEqual(score_water(101), 0.0)
        self.assertEqual(score_water(1000), 0.0)
        self.assertEqual(score_water(1001), -1.0)

    def test_criterion_2_mean(self) -> None:
        s = score_criterion_2(0, 5)  # +1 and +1
        self.assertAlmostEqual(s, 1.0)

    def test_efactor_buckets(self) -> None:
        self.assertEqual(score_efactor(0.5), 1.0)
        self.assertEqual(score_efactor(1.0), 1.0)
        self.assertEqual(score_efactor(1.1), 0.5)
        self.assertEqual(score_efactor(5.0), 0.5)
        self.assertEqual(score_efactor(5.1), 0.0)
        self.assertEqual(score_efactor(25.0), 0.0)
        self.assertEqual(score_efactor(25.1), -1.0)

    def test_compute_efactor(self) -> None:
        self.assertAlmostEqual(compute_efactor(10, 2), 5.0)
        with self.assertRaises(ValueError):
            compute_efactor(1, 0)


class TestScoringModes(unittest.TestCase):
    def test_all_na_returns_zero_with_flag(self) -> None:
        criteria = {i: CriterionInput(mode="NA") for i in range(1, 13)}
        result = score_route(criteria)
        self.assertTrue(result.all_na)
        self.assertEqual(result.global_score, 0.0)
        self.assertEqual(result.total_weight, 0.0)

    def test_unanswered_excluded_like_blank_form(self) -> None:
        criteria = {i: CriterionInput(mode="UNANSWERED") for i in range(1, 13)}
        result = score_route(criteria)
        self.assertFalse(result.all_na)
        self.assertEqual(result.global_score, 0.0)
        self.assertEqual(result.total_weight, 0.0)

        criteria[1] = CriterionInput(mode="VALID", score=1.0)
        result = score_route(criteria)
        self.assertAlmostEqual(result.global_score, 1.0)
        self.assertAlmostEqual(result.total_weight, 3.0)

    def test_anc_applies_penalty_and_keeps_weight(self) -> None:
        criteria = {i: CriterionInput(mode="NA") for i in range(1, 13)}
        criteria[1] = CriterionInput(mode="ANC")
        result = score_route(criteria)
        self.assertFalse(result.all_na)
        self.assertAlmostEqual(result.global_score, ANC_PENALTY)
        c1 = next(c for c in result.criteria if c.criterion_id == 1)
        self.assertEqual(c1.score, ANC_PENALTY)
        self.assertEqual(c1.effective_weight, 3.0)

    def test_na_excludes_from_numerator_and_denominator(self) -> None:
        criteria = {
            1: CriterionInput(mode="VALID", score=1.0),  # W=3
            7: CriterionInput(mode="VALID", score=-1.0),  # W=1
        }
        # Remaining default to VALID score 0 → they still contribute 0 to num but full weight
        # For a clean test, mark others NA
        for i in range(1, 13):
            if i not in criteria:
                criteria[i] = CriterionInput(mode="NA")
        result = score_route(criteria)
        expected = (1.0 * 3.0 + (-1.0) * 1.0) / (3.0 + 1.0)
        self.assertAlmostEqual(result.global_score, expected)

    def test_criterion_2_quantitative_path(self) -> None:
        criteria = {i: CriterionInput(mode="NA") for i in range(1, 13)}
        criteria[2] = CriterionInput(mode="VALID", transport_km=0, water_l_per_kg=5)
        result = score_route(criteria)
        self.assertAlmostEqual(result.global_score, 1.0)

    def test_criterion_8_from_masses(self) -> None:
        criteria = {i: CriterionInput(mode="NA") for i in range(1, 13)}
        criteria[8] = CriterionInput(mode="VALID", waste_mass_kg=0.5, product_mass_kg=1.0)
        result = score_route(criteria)
        self.assertAlmostEqual(result.global_score, 1.0)

    def test_delta_s(self) -> None:
        self.assertAlmostEqual(delta_s(0.5, -0.3), 0.8)
        self.assertAlmostEqual(delta_s(-0.2, 0.1), -0.3)

    def test_compare_routes_positive_delta(self) -> None:
        proposed = {i: CriterionInput(mode="VALID", score=1.0) for i in range(1, 13)}
        baseline = {i: CriterionInput(mode="VALID", score=-1.0) for i in range(1, 13)}
        p, b, d = compare_routes(proposed, baseline)
        self.assertAlmostEqual(p.global_score, 1.0)
        self.assertAlmostEqual(b.global_score, -1.0)
        self.assertAlmostEqual(d, 2.0)

    def test_mixed_modes_edge_case(self) -> None:
        criteria = {
            1: CriterionInput(mode="VALID", score=1.0),
            2: CriterionInput(mode="NA"),
            3: CriterionInput(mode="ANC"),
            4: CriterionInput(mode="VALID", score=0.0),
            5: CriterionInput(mode="VALID", score=-1.0),
            6: CriterionInput(mode="NA"),
            7: CriterionInput(mode="VALID", score=0.5),
            8: CriterionInput(mode="VALID", e_factor=3.0),
            9: CriterionInput(mode="ANC"),
            10: CriterionInput(mode="VALID", score=1.0),
            11: CriterionInput(mode="NA"),
            12: CriterionInput(mode="VALID", score=-1.0),
        }
        result = score_route(criteria)
        self.assertFalse(result.all_na)
        # Manual expected
        # included: 1(3*1), 3(3*-0.25), 4(3*0), 5(3*-1), 7(1*0.5), 8(3*0.5), 9(3*-0.25), 10(2*1), 12(1*-1)
        num = (
            3 * 1.0
            + 3 * ANC_PENALTY
            + 3 * 0.0
            + 3 * -1.0
            + 1 * 0.5
            + 3 * 0.5
            + 3 * ANC_PENALTY
            + 2 * 1.0
            + 1 * -1.0
        )
        den = 3 + 3 + 3 + 3 + 1 + 3 + 3 + 2 + 1
        self.assertAlmostEqual(result.global_score, num / den)
        self.assertAlmostEqual(result.total_weight, den)


if __name__ == "__main__":
    unittest.main()
