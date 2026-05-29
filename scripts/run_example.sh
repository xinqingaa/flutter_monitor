#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"
SERVER_PORT="${FM_SERVER_PORT:-3700}"
WEB_PORT="${FM_WORKBENCH_WEB_PORT:-4700}"
START_WORKBENCH=1
MONITOR_SERVER_URL=""
TEST_API_BASE_URL=""
FLUTTER_ARGS=()

usage() {
  cat <<'EOF'
Usage: bash scripts/run_example.sh [--no-workbench] [--server-url URL] [flutter run args...]

Default:
  Starts Flutter Monitor Workbench, injects FM_SERVER_URL, runs the Flutter example,
  and stops the Workbench when the Flutter run exits.

Options:
  --no-workbench    Run example without starting the local Workbench.
  --server-url URL  Send full JSON envelopes to a custom monitor endpoint.
EOF
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM HUP
  if [ "$START_WORKBENCH" -eq 1 ]; then
    bash "$ROOT_DIR/scripts/workbench.sh" stop >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}

trap cleanup EXIT INT TERM HUP

detect_host_ip() {
  ipconfig getifaddr en0 2>/dev/null ||
    ipconfig getifaddr en1 2>/dev/null ||
    hostname -I 2>/dev/null | awk '{print $1}'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --server-url)
      if [ "$#" -lt 2 ]; then
        echo "--server-url requires a URL." >&2
        exit 64
      fi
      MONITOR_SERVER_URL="$2"
      START_WORKBENCH=0
      shift 2
      ;;
    --no-workbench)
      START_WORKBENCH=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      FLUTTER_ARGS+=("$1")
      shift
      ;;
  esac
done

if [ "$START_WORKBENCH" -eq 1 ]; then
  bash "$ROOT_DIR/scripts/workbench.sh" background
  HOST_IP="$(detect_host_ip)"
  if [ -z "$HOST_IP" ]; then
    echo "Could not detect host IP. Use --server-url explicitly." >&2
    exit 1
  fi
  MONITOR_SERVER_URL="http://$HOST_IP:$SERVER_PORT/api/monitor/v1/events"
  TEST_API_BASE_URL="http://$HOST_IP:$SERVER_PORT"
  echo "Flutter Monitor Workbench: http://localhost:$WEB_PORT/"
fi

if [ -n "$MONITOR_SERVER_URL" ]; then
  echo "Flutter Monitor server: $MONITOR_SERVER_URL"
  FLUTTER_ARGS+=("--dart-define=FM_SERVER_URL=$MONITOR_SERVER_URL")
fi

if [ -n "$TEST_API_BASE_URL" ]; then
  echo "Flutter Monitor test API: $TEST_API_BASE_URL"
  FLUTTER_ARGS+=("--dart-define=FM_TEST_API_BASE_URL=$TEST_API_BASE_URL")
fi

cd "$EXAMPLE_DIR"
fvm flutter run "${FLUTTER_ARGS[@]}"
