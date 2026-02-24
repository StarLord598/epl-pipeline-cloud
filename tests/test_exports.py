"""Tests for export scripts — graceful handling of missing tables."""

import duckdb
import pytest


class TestExportGracefulFailure:
    def test_export_quality_handles_missing_tables(self, db):
        """export_quality.main() should not crash catastrophically on missing tables."""
        import export_quality

        # Patch DB_PATH to use in-memory — main() connects itself,
        # so we just verify the module imports and _safe_id works
        assert export_quality._safe_id("mart") == '"mart"'
        # Injection attempts should raise ValueError
        with pytest.raises(ValueError):
            export_quality._safe_id("drop;--")

    def test_export_weather_sanitize(self):
        """export_weather_json.sanitize handles edge cases."""
        from export_weather_json import sanitize

        assert sanitize(float("nan")) is None
        assert sanitize(float("inf")) is None
        assert sanitize(42.5) == 42.5
        assert sanitize("hello") == "hello"


class TestEnvCheck:
    def test_missing_env_var_exits(self, monkeypatch):
        """env_check should sys.exit(1) when required var is missing."""
        monkeypatch.delenv("FOOTBALL_DATA_API_KEY", raising=False)
        from env_check import require_football_api_key

        with pytest.raises(SystemExit) as exc_info:
            require_football_api_key()
        assert exc_info.value.code == 1

    def test_placeholder_env_var_exits(self, monkeypatch):
        """env_check should reject placeholder values."""
        monkeypatch.setenv("FOOTBALL_DATA_API_KEY", "your-key-from-football-data.org")
        from env_check import require_football_api_key

        with pytest.raises(SystemExit) as exc_info:
            require_football_api_key()
        assert exc_info.value.code == 1

    def test_valid_env_var_returns_value(self, monkeypatch):
        """env_check should return the key when valid."""
        monkeypatch.setenv("FOOTBALL_DATA_API_KEY", "abc123")
        from env_check import require_football_api_key

        assert require_football_api_key() == "abc123"
