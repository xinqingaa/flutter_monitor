#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKBENCH_DIR="$ROOT_DIR/workbench"
COMMAND="${1:-dev}"
SERVER_PORT="${FM_SERVER_PORT:-3000}"
WEB_PORT="${FM_WORKBENCH_WEB_PORT:-5173}"
PID_FILE="${FM_WORKBENCH_PID_FILE:-/tmp/flutter_monitor_workbench_${SERVER_PORT}.pid}"
DATA_DIR="${FM_WORKBENCH_DATA_DIR:-$WORKBENCH_DIR/.data}"
NDJSON_PATH="${FM_WORKBENCH_NDJSON_PATH:-$DATA_DIR/events.ndjson}"

run_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm was not found. Please install pnpm or enable Corepack." >&2
    exit 1
  fi
  pnpm --dir "$WORKBENCH_DIR" "$@"
}

install_dependencies() {
  run_pnpm install
}

listener_pid() {
  lsof -tiTCP:"$SERVER_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

web_listener_pid() {
  lsof -tiTCP:"$WEB_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

ensure_port_available() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [ -z "$pid" ]; then
    return 0
  fi

  echo "Cannot start Flutter Monitor workbench: $label port $port is already in use by pid=$pid." >&2
  echo "Run: bash scripts/workbench.sh stop" >&2
  echo "Or choose another port, for example: FM_SERVER_PORT=3010 FM_WORKBENCH_WEB_PORT=5174 bash scripts/workbench.sh dev" >&2
  return 1
}

status_service() {
  local pid
  pid="$(listener_pid || true)"
  if [ -n "$pid" ]; then
    echo "Flutter Monitor workbench service is listening on port $SERVER_PORT pid=$pid."
    return 0
  fi
  echo "Flutter Monitor workbench service is not listening on port $SERVER_PORT."
  return 1
}

stop_service() {
  local pid=""
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
  fi
  if [ -z "$pid" ]; then
    pid="$(listener_pid || true)"
  fi
  if [ -z "$pid" ]; then
    echo "No Flutter Monitor workbench service found on port $SERVER_PORT."
    rm -f "$PID_FILE"
    return 0
  fi

  echo "Stopping Flutter Monitor workbench service on port $SERVER_PORT pid=$pid..."
  kill "$pid" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$PID_FILE"

  local web_pid
  web_pid="$(web_listener_pid || true)"
  if [ -n "$web_pid" ]; then
    echo "Stopping Flutter Monitor workbench web on port $WEB_PORT pid=$web_pid..."
    kill "$web_pid" >/dev/null 2>&1 || true
  fi
}

case "$COMMAND" in
  install)
    install_dependencies
    ;;
  service|dev)
    install_dependencies
    mkdir -p "$DATA_DIR"
    ensure_port_available "$SERVER_PORT" "service"
    if [ "$COMMAND" = "dev" ]; then
      ensure_port_available "$WEB_PORT" "web"
    fi
    if [ "$COMMAND" = "dev" ]; then
      exec env PORT="$SERVER_PORT" FM_SERVER_PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" FM_WORKBENCH_NDJSON_PATH="$NDJSON_PATH" \
        pnpm --dir "$WORKBENCH_DIR" dev
    fi
    exec env PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" FM_WORKBENCH_NDJSON_PATH="$NDJSON_PATH" \
      pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-service dev
    ;;
  start)
    install_dependencies
    mkdir -p "$DATA_DIR"
    ensure_port_available "$SERVER_PORT" "service"
    exec env PORT="$SERVER_PORT" FM_WORKBENCH_NDJSON_PATH="$NDJSON_PATH" \
      pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-service start
    ;;
  build)
    install_dependencies
    run_pnpm build
    ;;
  typecheck)
    install_dependencies
    run_pnpm typecheck
    ;;
  status)
    status_service
    ;;
  stop)
    stop_service
    ;;
  web)
    echo "Workbench web is planned for Phase W4. Service inspector is available on http://localhost:$SERVER_PORT/."
    ;;
  *)
    echo "Usage: bash scripts/workbench.sh [install|service|dev|start|build|typecheck|status|stop|web]" >&2
    exit 64
    ;;
esac
