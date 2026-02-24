"""Tests for schema contract validation (scripts/contracts.py)."""

from contracts import validate_matches, validate_standings


class TestMatchContracts:
    def test_valid_match_passes(self, sample_match):
        result = validate_matches([sample_match])
        assert result.valid
        assert result.records_passed == 1
        assert len(result.violations) == 0

    def test_missing_required_field_fails(self, sample_match):
        del sample_match["status"]
        result = validate_matches([sample_match])
        assert len(result.violations) > 0

    def test_invalid_status_enum_fails(self, sample_match):
        sample_match["status"] = "INVALID_STATUS"
        result = validate_matches([sample_match])
        violations = [v for v in result.violations if v.field == "status"]
        assert len(violations) > 0

    def test_batch_below_threshold_still_valid(self, sample_match):
        """A single bad record in a batch of 20 should still pass (< 10% threshold)."""
        good = [sample_match.copy() for _ in range(19)]
        bad = sample_match.copy()
        del bad["status"]
        result = validate_matches(good + [bad])
        assert result.valid  # 1/20 = 5% failure, below 10% threshold

    def test_batch_above_threshold_fails(self, sample_match):
        """More than 10% bad records should fail the batch."""
        bad_records = []
        for _ in range(3):
            bad = sample_match.copy()
            del bad["status"]
            bad_records.append(bad)
        good = [sample_match.copy() for _ in range(7)]
        result = validate_matches(bad_records + good)
        assert not result.valid  # 3/10 = 30% failure


class TestStandingContracts:
    def test_valid_standing_passes(self, sample_standing):
        result = validate_standings([sample_standing])
        assert result.valid

    def test_missing_team_fails(self, sample_standing):
        del sample_standing["team"]
        result = validate_standings([sample_standing])
        assert len(result.violations) > 0

    def test_negative_points_fails(self, sample_standing):
        sample_standing["points"] = -5
        result = validate_standings([sample_standing])
        violations = [v for v in result.violations if "range" in v.rule]
        assert len(violations) > 0
