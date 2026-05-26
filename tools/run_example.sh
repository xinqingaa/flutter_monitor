#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"

cd "$EXAMPLE_DIR"
fvm flutter run "$@" 2>&1 | awk '
  /^I\/flutter/ { print; next }
  /^Flutter run key commands\./ { print; next }
  /^[rRhhdcq] / { print; next }
  /^A Dart VM Service/ { print; next }
  /^The Flutter DevTools/ { print; next }
  /^Syncing files to device/ { print; next }
  /^Reloaded / { print; next }
  /^Restarted application/ { print; next }
'
