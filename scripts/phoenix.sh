#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache_root="${XDG_CACHE_HOME:-$HOME/.cache}"
phoenix_venv="${PHOENIX_VENV_DIR:-$cache_root/eve-chat-agent/phoenix-venv}"

if [[ ! -x "$phoenix_venv/bin/phoenix" ]]; then
  echo "Phoenix virtual environment not found at $phoenix_venv" >&2
  echo "Set PHOENIX_VENV_DIR to an existing Phoenix virtual environment." >&2
  exit 1
fi

exec "$phoenix_venv/bin/phoenix" serve
