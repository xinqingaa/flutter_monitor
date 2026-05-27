#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/node_server"
COMMAND="${1:-start}"
SERVER_PORT="${FM_SERVER_PORT:-3000}"

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
  *)
    echo "Usage: bash scripts/node_server.sh [install|start|dev]" >&2
    exit 64
    ;;
esac
