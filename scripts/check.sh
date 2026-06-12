#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
fvm flutter pub get
fvm dart analyze

fvm flutter analyze packages/flutter_monitor_sdk
fvm flutter test packages/flutter_monitor_sdk/test

fvm dart analyze packages/flutter_monitor_core
fvm dart test packages/flutter_monitor_core

if [ -d packages/flutter_monitor_native ]; then
  fvm flutter analyze packages/flutter_monitor_native
  fvm flutter test packages/flutter_monitor_native/test
fi

if [ -d platform ]; then
  pnpm --dir platform install
  pnpm --dir platform typecheck
  pnpm --dir platform run smoke
fi
