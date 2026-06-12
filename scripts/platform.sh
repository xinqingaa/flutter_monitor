#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM_DIR="$ROOT_DIR/platform"
COMMAND="${1:-dev}"
SERVER_PORT="${FM_SERVER_PORT:-3700}"
WEB_PORT="${FM_WORKBENCH_WEB_PORT:-4700}"
DATA_DIR="${FM_WORKBENCH_DATA_DIR:-$PLATFORM_DIR/.data}"
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
  pnpm --dir "$PLATFORM_DIR" "$@"
}

install_dependencies() {
  run_pnpm install
}

listener_pid() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
}

is_platform_pid() {
  local pid="$1"
  local command
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ "$command" == *"flutter_monitor/platform"* ]] || [[ "$command" == *"@flutter-monitor/monitor-service"* ]] || [[ "$command" == *"@flutter-monitor/workbench-web"* ]]
}

platform_process_pids() {
  ps -ax -o pid= -o command= |
    awk -v root="$PLATFORM_DIR" '
      index($0, root) && $0 ~ /(node|pnpm|tsx|vite|esbuild|nest)/ { print $1 }
    '
}

print_service_urls() {
  echo "Monitor service: http://localhost:$SERVER_PORT"
  echo "Monitor service docs: http://localhost:$SERVER_PORT/docs"
  echo "OpenAPI JSON: http://localhost:$SERVER_PORT/docs-json"
}

print_web_url() {
  echo "Workbench web: http://localhost:$WEB_PORT"
}

build_service() {
  run_pnpm --filter @flutter-monitor/monitor-service run build
}

run_service_command() {
  exec env PORT="$SERVER_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
    node "$PLATFORM_DIR/services/monitor-service/dist/main.js"
}

ensure_port_available() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(listener_pid "$port" || true)"
  if [ -z "$pid" ]; then
    return 0
  fi
  if is_platform_pid "$pid"; then
    echo "Flutter Monitor platform $label already running on port $port pid=$pid."
    return 0
  fi

  echo "Cannot start Flutter Monitor platform: $label port $port is already in use by pid=$pid." >&2
  echo "Use another port, for example:" >&2
  echo "  FM_SERVER_PORT=3710 FM_WORKBENCH_WEB_PORT=4710 bash scripts/platform.sh dev" >&2
  return 1
}

is_port_used_by_platform() {
  local port="$1"
  local pid
  pid="$(listener_pid "$port" || true)"
  [ -n "$pid" ] && is_platform_pid "$pid"
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
    echo "Android app can use http://127.0.0.1:$SERVER_PORT (USB adb reverse)"
  else
    echo "No Android device detected for adb reverse. USB 真机请插入后重跑: ./scripts/platform.sh"
    echo "或运行: bash scripts/run_example.sh"
  fi
}

adb_reverse_status() {
  if [ "$USE_ADB_REVERSE" = "0" ]; then
    echo "Android adb reverse: disabled by FM_USE_ADB_REVERSE=0"
    return 0
  fi
  if ! command -v adb >/dev/null 2>&1; then
    echo "Android adb reverse: adb not found"
    return 0
  fi

  local mappings
  mappings="$(adb reverse --list 2>/dev/null | awk -v port="$SERVER_PORT" '$0 ~ "tcp:" port " tcp:" port { print }' || true)"
  if [ -n "$mappings" ]; then
    echo "Android adb reverse: configured for tcp:$SERVER_PORT"
    return 0
  fi

  echo "Android adb reverse: not configured for tcp:$SERVER_PORT"
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
  if [ -n "$current_pid" ] && is_platform_pid "$current_pid"; then
    echo "$current_pid" >"$SERVICE_PID_FILE"
    print_service_urls
    return 0
  fi

  ensure_port_available "$SERVER_PORT" "service"
  echo "Starting Monitor service on port $SERVER_PORT..."
  build_service >>"$LOG_FILE" 2>&1
  nohup env PORT="$SERVER_PORT" FM_WORKBENCH_SQLITE_PATH="$SQLITE_PATH" \
    node "$PLATFORM_DIR/services/monitor-service/dist/main.js" \
    >>"$LOG_FILE" 2>&1 </dev/null &
  echo "$!" >"$SERVICE_PID_FILE"
  wait_for_url "http://127.0.0.1:$SERVER_PORT/api/monitor/v1/health" "monitor service"
  print_service_urls
}

start_web_background() {
  mkdir -p "$RUN_DIR"
  local current_pid
  current_pid="$(listener_pid "$WEB_PORT" || true)"
  if [ -n "$current_pid" ] && is_platform_pid "$current_pid"; then
    echo "$current_pid" >"$WEB_PID_FILE"
    print_web_url
    return 0
  fi

  ensure_port_available "$WEB_PORT" "web"
  echo "Starting Workbench web on port $WEB_PORT..."
  nohup env FM_SERVER_PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" \
    pnpm --dir "$PLATFORM_DIR" --filter @flutter-monitor/workbench-web dev \
    >>"$LOG_FILE" 2>&1 </dev/null &
  echo "$!" >"$WEB_PID_FILE"
  wait_for_url "http://127.0.0.1:$WEB_PORT/" "workbench web"
  print_web_url
}

start_platform_background() {
  install_dependencies
  : >"$LOG_FILE"
  start_service_background
  start_web_background
  configure_adb_reverse
}

start_platform_foreground() {
  install_dependencies
  mkdir -p "$DATA_DIR"
  if is_port_used_by_platform "$SERVER_PORT" && is_port_used_by_platform "$WEB_PORT"; then
    echo "Flutter Monitor platform is already running."
    print_service_urls
    print_web_url
    configure_adb_reverse
    return 0
  fi
  if is_port_used_by_platform "$SERVER_PORT" || is_port_used_by_platform "$WEB_PORT"; then
    ensure_port_available "$SERVER_PORT" "service"
    ensure_port_available "$WEB_PORT" "web"
    start_service_background
    start_web_background
    configure_adb_reverse
    return 0
  fi
  ensure_port_available "$SERVER_PORT" "service"
  ensure_port_available "$WEB_PORT" "web"
  print_service_urls
  print_web_url
  start_service_background
  configure_adb_reverse
  exec env FM_SERVER_PORT="$SERVER_PORT" FM_WORKBENCH_WEB_PORT="$WEB_PORT" \
    pnpm --dir "$PLATFORM_DIR" --filter @flutter-monitor/workbench-web dev
}

start_service_foreground() {
  install_dependencies
  mkdir -p "$DATA_DIR"
  if is_port_used_by_platform "$SERVER_PORT"; then
    print_service_urls
    configure_adb_reverse
    return 0
  fi
  ensure_port_available "$SERVER_PORT" "service"
  configure_adb_reverse
  build_service
  run_service_command
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
  if [ -z "$pid" ] || ! kill -0 "$pid" >/dev/null 2>&1 || ! is_platform_pid "$pid"; then
    return 0
  fi

  local pids
  pids="$(descendant_pids "$pid"; echo "$pid")"
  echo "Stopping Flutter Monitor platform $label pid=$pid..."
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

stop_by_port_if_platform() {
  local port="$1"
  local label="$2"
  local pid
  pid="$(listener_pid "$port" || true)"
  if [ -n "$pid" ] && is_platform_pid "$pid"; then
    terminate_pid_tree "$pid" "$label on port $port"
  fi
}

stop_remaining_platform_processes() {
  local pids
  pids="$(platform_process_pids | sort -rn | tr '\n' ' ')"
  if [ -z "$pids" ]; then
    return 0
  fi
  echo "Stopping remaining Flutter Monitor platform processes: $pids"
  kill $pids >/dev/null 2>&1 || true
  sleep 0.3
  kill -9 $pids >/dev/null 2>&1 || true
}

stop_platform() {
  remove_adb_reverse
  stop_pid_file "$WEB_PID_FILE" "web"
  stop_pid_file "$SERVICE_PID_FILE" "service"
  stop_by_port_if_platform "$WEB_PORT" "web"
  stop_by_port_if_platform "$SERVER_PORT" "service"
  stop_remaining_platform_processes
}

status_platform() {
  local service_pid
  local web_pid
  service_pid="$(listener_pid "$SERVER_PORT" || true)"
  web_pid="$(listener_pid "$WEB_PORT" || true)"
  if [ -n "$service_pid" ]; then
    echo "Monitor service: http://localhost:$SERVER_PORT pid=$service_pid"
    echo "Monitor service docs: http://localhost:$SERVER_PORT/docs"
  else
    echo "Monitor service is not running on port $SERVER_PORT."
  fi
  if [ -n "$web_pid" ]; then
    echo "Workbench web: http://localhost:$WEB_PORT pid=$web_pid"
  else
    echo "Workbench web is not running on port $WEB_PORT."
  fi
  adb_reverse_status
}

case "$COMMAND" in
  install)
    install_dependencies
    ;;
  dev|start|web)
    start_platform_foreground
    ;;
  background)
    start_platform_background
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
    status_platform
    ;;
  stop)
    stop_platform
    ;;
  restart)
    stop_platform
    start_platform_foreground
    ;;
  adb-reverse|adb)
    configure_adb_reverse
    ;;
  *)
    echo "Usage: ./scripts/platform.sh [install|dev|start|web|background|service|build|typecheck|status|stop|restart|adb-reverse]" >&2
    exit 64
    ;;
esac
