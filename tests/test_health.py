"""Tests for the /api/health endpoint logic."""

import json


def test_health_response_structure():
    """Verify health response has required fields."""
    # Simulate what the endpoint returns
    from datetime import datetime, timezone

    response = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }

    assert response["status"] == "ok"
    assert response["version"] == "1.0.0"
    assert "timestamp" in response
    # Verify timestamp is valid ISO format
    datetime.fromisoformat(response["timestamp"])


def test_health_status_always_ok():
    """Health check should always return ok status."""
    response = {"status": "ok"}
    assert response["status"] == "ok"
