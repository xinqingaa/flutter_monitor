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
ADB_REVERSE_FILE="$RUN_DIR/adb_reverse_${SERVER_PORT}.devices"
USE_ADB_REVERSE="${FM_USE_ADB_REVERSE:-1}"

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

workbench_process_pids() {
  ps -ax -o pid= -o command= |
    awk -v root="$WORKBENCH_DIR" '
      index($0, root) && $0 ~ /(node|pnpm|tsx|vite|esbuild)/ { print $1 }
    '
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

is_port_used_by_workbench() {
  local port="$1"
  local pid
  pid="$(listener_pid "$port" || true)"
  [ -n "$pid" ] && is_workbench_pid "$pid"
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

configure_adb_reverse() {
  if [ "$USE_ADB_REVERSE" = "0" ]; then
    return 0
  fi
  if ! command -v adb >/dev/null 2>&1; then
    return 0
  fi

  mkdir -p "$RUN_DIR"
  : >"$ADB_REVERSE_FILE"

  local device
  local configured=0
  while IFS= read -r device; do
    [ -z "$device" ] && continue
    if adb -s "$device" reverse "tcp:$SERVER_PORT" "tcp:$SERVER_PORT" >/dev/null 2>&1; then
      echo "$device" >>"$ADB_REVERSE_FILE"
      configured=1
    fi
  done < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')

  if [ "$configured" -eq 1 ]; then
    echo "Android adb reverse: device localhost:$SERVER_PORT -> host localhost:$SERVER_PORT"
  fi
}

remove_adb_reverse() {
  if ! command -v adb >/dev/null 2>&1; then
    rm -f "$ADB_REVERSE_FILE"
    return 0
  fi

  local device
  if [ -f "$ADB_REVERSE_FILE" ]; then
    while IFS= read -r device; do
      [ -z "$device" ] && continue
      adb -s "$device" reverse --remove "tcp:$SERVER_PORT" >/dev/null 2>&1 || true
    done <"$ADB_REVERSE_FILE"
    rm -f "$ADB_REVERSE_FILE"
  fi
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
  echo "$!" >"$SERVICE_PID_FILE"
  wait_for_url "http://127.0.0.1:$SERVER_PORT/api/monitor/v1/health" "workbench service"
  current_pid="$(listener_pid "$SERVER_PORT" || true)"
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
  echo "$!" >"$WEB_PID_FILE"
  wait_for_url "http://127.0.0.1:$WEB_PORT/" "workbench web"
  current_pid="$(listener_pid "$WEB_PORT" || true)"
  echo "Workbench web: http://localhost:$WEB_PORT"
}

start_workbench_background() {
  install_dependencies
  : >"$LOG_FILE"
  start_service_background
  start_web_background
  configure_adb_reverse
}

start_workbench_foreground() {
  install_dependencies
  mkdir -p "$DATA_DIR"
  if is_port_used_by_workbench "$SERVER_PORT" && is_port_used_by_workbench "$WEB_PORT"; then
    echo "Flutter Monitor workbench is already running."
    echo "Workbench service: http://localhost:$SERVER_PORT"
    echo "Workbench web: http://localhost:$WEB_PORT"
    return 0
  fi
  if is_port_used_by_workbench "$SERVER_PORT" || is_port_used_by_workbench "$WEB_PORT"; then
    ensure_port_available "$SERVER_PORT" "service"
    ensure_port_available "$WEB_PORT" "web"
    start_service_background
    start_web_background
    configure_adb_reverse
    return 0
  fi
  ensure_port_available "$SERVER_PORT" "service"
  ensure_port_available "$WEB_PORT" "web"
  echo "Workbench service: http://localhost:$SERVER_PORT"
  echo "Workbench web: http://localhost:$WEB_PORT"
  configure_adb_reverse
  exec env PORT="$SERVER_PORT" FM_SERVER_PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
    pnpm --dir "$WORKBENCH_DIR" dev
}

start_service_foreground() {
  install_dependencies
  mkdir -p "$DATA_DIR"
  if is_port_used_by_workbench "$SERVER_PORT"; then
    echo "Workbench service: http://localhost:$SERVER_PORT"
    configure_adb_reverse
    return 0
  fi
  ensure_port_available "$SERVER_PORT" "service"
  configure_adb_reverse
  exec env PORT="$SERVER_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
    pnpm --dir "$WORKBENCH_DIR" --filter @flutter-monitor/workbench-service dev
}

descendant_pids() {
  local pid
  pid="$1"
  local child
  while IFS= read -r child; do
    [ -z "$child" ] && continue
    echo "$child"
    descendant_pids "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)
}

terminate_pid_tree() {
  local pid="$1"
  local label="$2"
  if [ -z "$pid" ] || ! kill -0 "$pid" >/dev/null 2>&1 || ! is_workbench_pid "$pid"; then
    return 0
  fi

  local pids
  pids="$(descendant_pids "$pid"; echo "$pid")"
  echo "Stopping Flutter Monitor workbench $label pid=$pid..."
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    kill "$pid" >/dev/null 2>&1 || true
  done <<<"$pids"

  for _ in $(seq 1 30); do
    local any_alive=0
    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      if kill -0 "$pid" >/dev/null 2>&1; then
        any_alive=1
        break
      fi
    done <<<"$pids"
    [ "$any_alive" -eq 0 ] && return 0
    sleep 0.1
  done

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    kill -9 "$pid" >/dev/null 2>&1 || true
  done <<<"$pids"
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [ ! -f "$pid_file" ]; then
    return 0
  fi
  local pid
  pid="$(cat "$pid_file")"
  terminate_pid_tree "$pid" "$label"
  rm -f "$pid_file"
}

stop_by_port_if_workbench() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(listener_pid "$port" || true)"
  if [ -n "$pid" ] && is_workbench_pid "$pid"; then
    terminate_pid_tree "$pid" "$label on port $port"
  fi
}

stop_remaining_workbench_processes() {
  local pids
  pids="$(workbench_process_pids | sort -rn | tr '\n' ' ')"
  if [ -z "$pids" ]; then
    return 0
  fi
  echo "Stopping remaining Flutter Monitor workbench processes: $pids"
  kill $pids >/dev/null 2>&1 || true
  sleep 0.3
  kill -9 $pids >/dev/null 2>&1 || true
}

stop_workbench() {
  remove_adb_reverse
  stop_pid_file "$WEB_PID_FILE" "web"
  stop_pid_file "$SERVICE_PID_FILE" "service"
  stop_by_port_if_workbench "$WEB_PORT" "web"
  stop_by_port_if_workbench "$SERVER_PORT" "service"
  stop_remaining_workbench_processes
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
    start_workbench_foreground
    ;;
  background)
    start_workbench_background
    ;;
  service)
    start_service_foreground
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
    start_workbench_foreground
    ;;
  *)
    echo "Usage: bash scripts/workbench.sh [install|dev|web|background|service|build|typecheck|status|stop|restart]" >&2
    exit 64
    ;;
esac
