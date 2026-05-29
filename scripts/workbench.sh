#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKBENCH_DIR="$ROOT_DIR/workbench"
COMMAND="${1:-dev}"
SERVER_PORT="${FM_SERVER_PORT:-3700}"
WEB_PORT="${FM_WORKBENCH_WEB_PORT:-4700}"
DATA_DIR="${FM_WORKBENCH_DATA_DIR:-$WORKBENCH_DIR/.data}"
SQLITE_PATH="${FM_WORKBENCH_SQLITE_PATH:-$DATA_DIR/events.sqlite}"
RUN_DIR="${FM_WORKBENCH_RUN_DIR:-/tmp/flutter_monitor_workbench}"
SERVICE_PID_FILE="$RUN_DIR/service_${SERVER_PORT}.pid"
WEB_PID_FILE="$RUN_DIR/web_${WEB_PORT}.pid"
LOG_FILE="${FM_WORKBENCH_LOG:-/tmp/flutter_monitor_workbench.log}"

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
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
}

is_workbench_pid() {
  local pid="$1"
  local command
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"flutter_monitor/workbench"* ]] || [[ "$command" == *"@flutter-monitor/workbench"* ]]
}

ensure_port_available() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(listener_pid "$port" || true)"
  if [ -z "$pid" ]; then
    return 0
  fi
  if is_workbench_pid "$pid"; then
    echo "Flutter Monitor workbench $label already running on port $port pid=$pid."
    return 0
  fi

  echo "Cannot start Flutter Monitor workbench: $label port $port is already in use by pid=$pid." >&2
  echo "Use another port, for example:" >&2
  echo "  FM_SERVER_PORT=3710 FM_WORKBENCH_WEB_PORT=4710 bash scripts/workbench.sh dev" >&2
  return 1
}

wait_for_url() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 80); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.15
  done
  echo "Timed out waiting for $label at $url. See $LOG_FILE" >&2
  return 1
}

start_service_background() {
  mkdir -p "$RUN_DIR" "$DATA_DIR"
  local current_pid
  current_pid="$(listener_pid "$SERVER_PORT" || true)"
  if [ -n "$current_pid" ] && is_workbench_pid "$current_pid"; then
    echo "$current_pid" >"$SERVICE_PID_FILE"
    echo "Workbench service: http://localhost:$SERVER_PORT"
    return 0
  fi

  ensure_port_available "$SERVER_PORT" "service"
  echo "Starting Flutter Monitor workbench service on port $SERVER_PORT..."
  nohup env PORT="$SERVER_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
    pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-service dev \
    >>"$LOG_FILE" 2>&1 </dev/null &
  wait_for_url "http://127.0.0.1:$SERVER_PORT/api/monitor/v1/health" "workbench service"
  current_pid="$(listener_pid "$SERVER_PORT" || true)"
  if [ -n "$current_pid" ]; then
    echo "$current_pid" >"$SERVICE_PID_FILE"
  fi
  echo "Workbench service: http://localhost:$SERVER_PORT"
}

start_web_background() {
  mkdir -p "$RUN_DIR"
  local current_pid
  current_pid="$(listener_pid "$WEB_PORT" || true)"
  if [ -n "$current_pid" ] && is_workbench_pid "$current_pid"; then
    echo "$current_pid" >"$WEB_PID_FILE"
    echo "Workbench web: http://localhost:$WEB_PORT"
    return 0
  fi

  ensure_port_available "$WEB_PORT" "web"
  echo "Starting Flutter Monitor workbench web on port $WEB_PORT..."
  nohup env FM_SERVER_PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" \
    pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-web dev \
    >>"$LOG_FILE" 2>&1 </dev/null &
  wait_for_url "http://127.0.0.1:$WEB_PORT/" "workbench web"
  current_pid="$(listener_pid "$WEB_PORT" || true)"
  if [ -n "$current_pid" ]; then
    echo "$current_pid" >"$WEB_PID_FILE"
  fi
  echo "Workbench web: http://localhost:$WEB_PORT"
}

start_workbench_background() {
  install_dependencies
  : >"$LOG_FILE"
  start_service_background
  start_web_background
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [ ! -f "$pid_file" ]; then
    return 0
  fi
  local pid
  pid="$(cat "$pid_file")"
  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
    if is_workbench_pid "$pid"; then
      echo "Stopping Flutter Monitor workbench $label pid=$pid..."
      kill "$pid" >/dev/null 2>&1 || true
      for _ in $(seq 1 30); do
        if ! kill -0 "$pid" >/dev/null 2>&1; then
          break
        fi
        sleep 0.1
      done
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
  fi
  rm -f "$pid_file"
}

stop_by_port_if_workbench() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(listener_pid "$port" || true)"
  if [ -n "$pid" ] && is_workbench_pid "$pid"; then
    echo "Stopping Flutter Monitor workbench $label on port $port pid=$pid..."
    kill "$pid" >/dev/null 2>&1 || true
  fi
}

stop_workbench() {
  stop_pid_file "$WEB_PID_FILE" "web"
  stop_pid_file "$SERVICE_PID_FILE" "service"
  stop_by_port_if_workbench "$WEB_PORT" "web"
  stop_by_port_if_workbench "$SERVER_PORT" "service"
}

status_workbench() {
  local service_pid
  local web_pid
  service_pid="$(listener_pid "$SERVER_PORT" || true)"
  web_pid="$(listener_pid "$WEB_PORT" || true)"
  if [ -n "$service_pid" ]; then
    echo "Workbench service: http://localhost:$SERVER_PORT pid=$service_pid"
  else
    echo "Workbench service is not running on port $SERVER_PORT."
  fi
  if [ -n "$web_pid" ]; then
    echo "Workbench web: http://localhost:$WEB_PORT pid=$web_pid"
  else
    echo "Workbench web is not running on port $WEB_PORT."
  fi
}

case "$COMMAND" in
  install)
    install_dependencies
    ;;
  dev|start|web)
    start_workbench_background
    ;;
  service)
    install_dependencies
    mkdir -p "$DATA_DIR"
    ensure_port_available "$SERVER_PORT" "service"
    exec env PORT="$SERVER_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
      pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-service dev
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
    status_workbench
    ;;
  stop)
    stop_workbench
    ;;
  restart)
    stop_workbench
    start_workbench_background
    ;;
  *)
    echo "Usage: bash scripts/workbench.sh [install|dev|web|service|build|typecheck|status|stop|restart]" >&2
    exit 64
    ;;
esac
