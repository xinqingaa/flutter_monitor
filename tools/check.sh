#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
flutter pub get
dart analyze

flutter analyze packages/flutter_monitor_sdk
flutter test packages/flutter_monitor_sdk/test

dart analyze packages/flutter_monitor_core
dart test packages/flutter_monitor_core

flutter analyze packages/flutter_monitor_native
flutter test packages/flutter_monitor_native/test
