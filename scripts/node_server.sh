#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMAND="${1:-start}"

case "$COMMAND" in
  install)
    exec bash "$ROOT_DIR/scripts/workbench.sh" install
    ;;
  start|server|dev)
    exec bash "$ROOT_DIR/scripts/workbench.sh" service
    ;;
  status)
    exec bash "$ROOT_DIR/scripts/workbench.sh" status
    ;;
  stop)
    exec bash "$ROOT_DIR/scripts/workbench.sh" stop
    ;;
  *)
    echo "Usage: bash scripts/node_server.sh [install|start|dev|status|stop]" >&2
    exit 64
    ;;
esac
