#!/usr/bin/env python3
"""Data contracts — validate API responses against expected schemas before ingestion.

Catches breaking API changes at the gate before they poison Bronze/Silver/Gold.
Used as a pre-check in ingestion scripts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ContractViolation:
    """A single contract violation."""
    field: str
    rule: str
    message: str
    severity: str = "ERROR"  # ERROR = block, WARN = log only


@dataclass
class ContractResult:
    """Result of validating data against a contract."""
    contract_name: str
    valid: bool
    violations: list[ContractViolation] = field(default_factory=list)
    records_checked: int = 0
    records_passed: int = 0

    @property
    def pass_rate(self) -> float:
        return self.records_passed / self.records_checked if self.records_checked else 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Contract definitions
# ──────────────────────────────────────────────────────────────────────────────

MATCH_CONTRACT = {
    "name": "football_data_match",
    "description": "football-data.org /matches endpoint",
    "required_fields": ["id", "utcDate", "status", "matchday", "homeTeam", "awayTeam"],
    "field_types": {
        "id": int,
        "matchday": int,
        "utcDate": str,
        "status": str,
    },
    "enum_values": {
        "status": [
            "SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "HALFTIME",
            "EXTRA_TIME", "PENALTY_SHOOTOUT", "FINISHED", "SUSPENDED",
            "POSTPONED", "CANCELLED", "AWARDED",
        ],
    },
    "range_checks": {
        "matchday": (1, 38),
    },
    "nested_required": {
        "homeTeam": ["id", "name"],
        "awayTeam": ["id", "name"],
    },
}

STANDINGS_CONTRACT = {
    "name": "football_data_standings",
    "description": "football-data.org /standings endpoint",
    "required_fields": ["position", "team", "playedGames", "won", "draw", "lost", "points",
                        "goalsFor", "goalsAgainst", "goalDifference"],
    "field_types": {
        "position": int,
        "playedGames": int,
        "won": int,
        "draw": int,
        "lost": int,
        "points": int,
        "goalsFor": int,
        "goalsAgainst": int,
    },
    "range_checks": {
        "position": (1, 20),
        "playedGames": (0, 38),
        "points": (0, 114),  # max 38 * 3
    },
    "nested_required": {
        "team": ["id", "name"],
    },
}


def validate_record(record: dict[str, Any], contract: dict) -> list[ContractViolation]:
    """Validate a single record against a contract."""
    violations: list[ContractViolation] = []

    # Required fields
    for field_name in contract.get("required_fields", []):
        if field_name not in record:
            violations.append(ContractViolation(
                field=field_name, rule="required",
                message=f"Missing required field: {field_name}",
            ))

    # Type checks
    for field_name, expected_type in contract.get("field_types", {}).items():
        if field_name in record and record[field_name] is not None:
            if not isinstance(record[field_name], expected_type):
                violations.append(ContractViolation(
                    field=field_name, rule="type",
                    message=f"Expected {expected_type.__name__}, got {type(record[field_name]).__name__}",
                ))

    # Enum checks
    for field_name, allowed in contract.get("enum_values", {}).items():
        if field_name in record and record[field_name] not in allowed:
            violations.append(ContractViolation(
                field=field_name, rule="enum",
                message=f"Value '{record[field_name]}' not in allowed values: {allowed}",
                severity="WARN",
            ))

    # Range checks
    for field_name, (min_val, max_val) in contract.get("range_checks", {}).items():
        if field_name in record and record[field_name] is not None:
            val = record[field_name]
            if isinstance(val, (int, float)) and not (min_val <= val <= max_val):
                violations.append(ContractViolation(
                    field=field_name, rule="range",
                    message=f"Value {val} outside range [{min_val}, {max_val}]",
                ))

    # Nested required fields
    for parent, children in contract.get("nested_required", {}).items():
        if parent in record and isinstance(record[parent], dict):
            for child in children:
                if child not in record[parent]:
                    violations.append(ContractViolation(
                        field=f"{parent}.{child}", rule="nested_required",
                        message=f"Missing nested field: {parent}.{child}",
                    ))

    return violations


def validate_payload(
    records: list[dict[str, Any]],
    contract: dict,
    fail_threshold: float = 0.1,
) -> ContractResult:
    """Validate a list of records against a contract.

    Args:
        records: list of dicts to validate
        contract: contract definition
        fail_threshold: fraction of records that can fail before blocking (default 10%)

    Returns:
        ContractResult with pass/fail status and violations
    """
    result = ContractResult(
        contract_name=contract["name"],
        valid=True,
        records_checked=len(records),
    )

    all_violations: list[ContractViolation] = []
    failed_records = 0

    for record in records:
        violations = validate_record(record, contract)
        errors = [v for v in violations if v.severity == "ERROR"]
        if errors:
            failed_records += 1
            all_violations.extend(errors)
        # Collect warnings too
        all_violations.extend(v for v in violations if v.severity == "WARN")

    result.records_passed = len(records) - failed_records
    result.violations = all_violations

    failure_rate = failed_records / len(records) if records else 0
    if failure_rate > fail_threshold:
        result.valid = False
        logger.error(
            f"Contract '{contract['name']}' FAILED: {failed_records}/{len(records)} records "
            f"({failure_rate:.1%}) exceeded threshold ({fail_threshold:.1%})"
        )
    else:
        logger.info(
            f"Contract '{contract['name']}' PASSED: {result.records_passed}/{len(records)} records OK"
        )

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Convenience wrappers
# ──────────────────────────────────────────────────────────────────────────────

def validate_matches(matches: list[dict]) -> ContractResult:
    """Validate match data from football-data.org."""
    return validate_payload(matches, MATCH_CONTRACT)


def validate_standings(standings: list[dict]) -> ContractResult:
    """Validate standings data from football-data.org."""
    return validate_payload(standings, STANDINGS_CONTRACT)


if __name__ == "__main__":
    # Quick self-test
    logging.basicConfig(level=logging.INFO)

    good_match = {
        "id": 1, "utcDate": "2026-02-23T15:00:00Z", "status": "FINISHED",
        "matchday": 27, "homeTeam": {"id": 57, "name": "Arsenal FC"},
        "awayTeam": {"id": 65, "name": "Manchester City FC"},
    }
    bad_match = {"id": "not_a_number", "status": "INVALID"}

    result = validate_matches([good_match, bad_match])
    print(f"\nResult: {'PASS' if result.valid else 'FAIL'}")
    print(f"  {result.records_passed}/{result.records_checked} records OK")
    for v in result.violations:
        print(f"  [{v.severity}] {v.field}: {v.message}")
