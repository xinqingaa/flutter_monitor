#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/node_server"
COMMAND="${1:-start}"
SERVER_PORT="${FM_SERVER_PORT:-3000}"
PID_FILE="${FM_NODE_SERVER_PID_FILE:-/tmp/flutter_monitor_node_server_${SERVER_PORT}.pid}"

cd "$SERVER_DIR"

run_package_manager() {
  local script="$1"
  shift || true

  if command -v pnpm >/dev/null 2>&1; then
    PORT="$SERVER_PORT" pnpm run "$script" "$@"
    return
  fi

  if command -v npm >/dev/null 2>&1; then
    PORT="$SERVER_PORT" npm run "$script" -- "$@"
    return
  fi

  echo "Neither pnpm nor npm was found. Please install Node.js package tooling." >&2
  exit 1
}

install_dependencies() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
    return
  fi

  if command -v npm >/dev/null 2>&1; then
    npm install
    return
  fi

  echo "Neither pnpm nor npm was found. Please install Node.js package tooling." >&2
  exit 1
}

listener_pid() {
  lsof -tiTCP:"$SERVER_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

status_server() {
  local pid
  pid="$(listener_pid || true)"
  if [ -n "$pid" ]; then
    echo "Flutter Monitor node_server is listening on port $SERVER_PORT pid=$pid."
    return 0
  fi
  echo "Flutter Monitor node_server is not listening on port $SERVER_PORT."
  return 1
}

stop_server() {
  local pid=""
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
  fi
  if [ -z "$pid" ]; then
    pid="$(listener_pid || true)"
  fi
  if [ -z "$pid" ]; then
    echo "No Flutter Monitor node_server found on port $SERVER_PORT."
    rm -f "$PID_FILE"
    return 0
  fi

  echo "Stopping Flutter Monitor node_server on port $SERVER_PORT pid=$pid..."
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
}

case "$COMMAND" in
  install)
    install_dependencies
    ;;
  start|server)
    run_package_manager server
    ;;
  dev)
    run_package_manager dev
    ;;
  status)
    status_server
    ;;
  stop)
    stop_server
    ;;
  *)
    echo "Usage: bash scripts/node_server.sh [install|start|dev|status|stop]" >&2
    exit 64
    ;;
esac
