#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec /usr/bin/env python3 "$DIR/plugin.py" "$@"
