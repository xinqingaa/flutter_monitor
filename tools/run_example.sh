#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"

cd "$EXAMPLE_DIR"
flutter run "$@"
