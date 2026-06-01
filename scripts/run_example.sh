#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"
SERVER_PORT="${FM_SERVER_PORT:-3700}"
WEB_PORT="${FM_WORKBENCH_WEB_PORT:-4700}"
HOST_IP="${FM_HOST_IP:-}"
START_WORKBENCH=1
WORKBENCH_STARTED=0
RUN_DIR="${FM_WORKBENCH_RUN_DIR:-/tmp/flutter_monitor_workbench}"
ADB_REVERSE_FILE="$RUN_DIR/adb_reverse_${SERVER_PORT}.devices"
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

Environment:
  FM_HOST_IP        Override the host IP injected into the Flutter example.
  FM_USE_ADB_REVERSE
                    Set to 0 to disable Android adb reverse in workbench.sh.
EOF
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM HUP
  if [ "$WORKBENCH_STARTED" -eq 1 ]; then
    bash "$ROOT_DIR/scripts/workbench.sh" stop >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}

trap cleanup EXIT INT TERM HUP

detect_host_ip() {
  if [ -n "${FM_HOST_IP:-}" ]; then
    echo "$FM_HOST_IP"
    return 0
  fi

  if command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    local default_iface
    default_iface="$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
    if [ -n "$default_iface" ]; then
      ipconfig getifaddr "$default_iface" 2>/dev/null && return 0
    fi
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    local iface ip
    for iface in en0 en1 en2 en3 en4 en5 en6 en7 en8 bridge100; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      if is_usable_host_ip "$ip"; then
        echo "$ip"
        return 0
      fi
    done
  fi

  hostname -I 2>/dev/null | tr ' ' '\n' | awk '
    /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/ { print; exit }
  '
}

is_usable_host_ip() {
  local ip="${1:-}"
  [[ "$ip" =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.) ]]
}

workbench_is_running() {
  curl -fsS "http://127.0.0.1:$SERVER_PORT/api/monitor/v1/health" >/dev/null 2>&1 &&
    curl -fsS "http://127.0.0.1:$WEB_PORT/" >/dev/null 2>&1
}

adb_reverse_is_configured() {
  [ -s "$ADB_REVERSE_FILE" ]
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
  if ! workbench_is_running; then
    WORKBENCH_STARTED=1
  fi
  bash "$ROOT_DIR/scripts/workbench.sh" background
  if adb_reverse_is_configured; then
    MONITOR_SERVER_URL="http://127.0.0.1:$SERVER_PORT/api/monitor/v1/events"
    TEST_API_BASE_URL="http://127.0.0.1:$SERVER_PORT"
    echo "Android adb reverse: device localhost:$SERVER_PORT -> host localhost:$SERVER_PORT"
  else
    HOST_IP="$(detect_host_ip)"
    if [ -z "$HOST_IP" ]; then
      echo "Could not detect host IP. Use --server-url explicitly." >&2
      exit 1
    fi
    MONITOR_SERVER_URL="http://$HOST_IP:$SERVER_PORT/api/monitor/v1/events"
    TEST_API_BASE_URL="http://$HOST_IP:$SERVER_PORT"
  fi
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
