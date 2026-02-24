"""Validate required environment variables before pipeline execution."""

import os
import sys


def require_env(var_name: str, hint: str = "") -> str:
    """Return the value of an env var or exit with a clear error."""
    value = os.environ.get(var_name, "").strip()
    if not value or value == "your-key-from-football-data.org":
        msg = f"[ENV CHECK] ERROR: {var_name} is not set or is a placeholder."
        if hint:
            msg += f" {hint}"
        print(msg, file=sys.stderr)
        sys.exit(1)
    return value


def require_football_api_key() -> str:
    """Validate and return FOOTBALL_DATA_API_KEY."""
    return require_env(
        "FOOTBALL_DATA_API_KEY",
        hint="Get a free key at https://www.football-data.org/client/register",
    )
