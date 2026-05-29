#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"
SERVER_PORT="${FM_SERVER_PORT:-3000}"
SERVER_PID=""
SERVER_STARTED_BY_SCRIPT=0
WORKBENCH_LOG="${FM_WORKBENCH_LOG:-/tmp/flutter_monitor_workbench.log}"

usage() {
  cat <<'EOF'
Usage: bash scripts/run_example.sh [--server-url URL] [--local-workbench] [flutter run args...]

Options:
  --server-url URL   Send full JSON envelopes to this monitor endpoint.
  --local-workbench  Start/check workbench service and use the current Mac LAN IP.
  --local-server     Compatibility alias for --local-workbench.

Examples:
  bash scripts/workbench.sh service
  bash scripts/run_example.sh --local-workbench
  bash scripts/run_example.sh --server-url http://192.168.1.10:3000/api/monitor/v1/events
EOF
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM HUP
  if [ "$SERVER_STARTED_BY_SCRIPT" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      echo "Stopping Flutter Monitor local server pid=$SERVER_PID..."
      kill "$SERVER_PID" >/dev/null 2>&1 || true
      for _ in $(seq 1 20); do
        if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
          break
        fi
        sleep 0.1
      done
      if kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        kill -9 "$SERVER_PID" >/dev/null 2>&1 || true
      fi
    fi
  fi
  exit "$exit_code"
}

trap cleanup EXIT INT TERM HUP

detect_host_ip() {
  ipconfig getifaddr en0 2>/dev/null ||
    ipconfig getifaddr en1 2>/dev/null ||
    hostname -I 2>/dev/null | awk '{print $1}'
}

package_runner() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
    return
  fi

  echo ""
}

local_server_ready() {
  curl -fsS "http://127.0.0.1:$SERVER_PORT/api/monitor/v1/health" >/dev/null 2>&1
}

workbench_dependencies_ready() {
  pnpm --dir "$ROOT_DIR/workbench" --filter @flutter-monitor/workbench-service exec node -e "require.resolve('tsx')" >/dev/null 2>&1
}

ensure_workbench_dependencies() {
  if workbench_dependencies_ready; then
    return
  fi

  echo "Installing Flutter Monitor workbench dependencies..."
  bash "$ROOT_DIR/scripts/workbench.sh" install
}

ensure_local_server() {
  if local_server_ready; then
    echo "Flutter Monitor workbench service is already running on port $SERVER_PORT."
    echo "Flutter Monitor Workbench: http://localhost:$SERVER_PORT/"
    return
  fi

  local runner
  runner="$(package_runner)"
  if [ -z "$runner" ]; then
    echo "pnpm was not found. Cannot start workbench service." >&2
    exit 1
  fi

  ensure_workbench_dependencies

  echo "Starting Flutter Monitor workbench service on port $SERVER_PORT..."
  (
    cd "$ROOT_DIR"
    exec env PORT="$SERVER_PORT" bash scripts/workbench.sh service >"$WORKBENCH_LOG" 2>&1
  ) &
  SERVER_PID=$!
  SERVER_STARTED_BY_SCRIPT=1

  for _ in $(seq 1 30); do
    if local_server_ready; then
      echo "Flutter Monitor workbench service is ready."
      echo "Flutter Monitor Workbench: http://localhost:$SERVER_PORT/"
      return
    fi
    sleep 0.2
  done

  echo "Failed to start workbench service. See $WORKBENCH_LOG" >&2
  exit 1
}

MONITOR_SERVER_URL=""
TEST_API_BASE_URL=""
FLUTTER_ARGS=()

if [ "$#" -eq 0 ]; then
  set -- --local-server
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --server-url)
      if [ "$#" -lt 2 ]; then
        echo "--server-url requires a URL." >&2
        exit 64
      fi
      MONITOR_SERVER_URL="$2"
      shift 2
      ;;
    --local-workbench|--local-server)
      ensure_local_server
      HOST_IP="$(detect_host_ip)"
      if [ -z "$HOST_IP" ]; then
        echo "Could not detect host IP. Use --server-url explicitly." >&2
        exit 1
      fi
      MONITOR_SERVER_URL="http://$HOST_IP:$SERVER_PORT/api/monitor/v1/events"
      TEST_API_BASE_URL="http://$HOST_IP:$SERVER_PORT"
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

if [ -n "$MONITOR_SERVER_URL" ]; then
  echo "Flutter Monitor server: $MONITOR_SERVER_URL"
  FLUTTER_ARGS+=("--dart-define=FM_SERVER_URL=$MONITOR_SERVER_URL")
fi

if [ -n "$TEST_API_BASE_URL" ]; then
  echo "Flutter Monitor test API: $TEST_API_BASE_URL"
  FLUTTER_ARGS+=("--dart-define=FM_TEST_API_BASE_URL=$TEST_API_BASE_URL")
fi

cd "$EXAMPLE_DIR"
if [ "${#FLUTTER_ARGS[@]}" -gt 0 ]; then
  fvm flutter run "${FLUTTER_ARGS[@]}"
else
  fvm flutter run
fi
