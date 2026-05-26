#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE_DIR="$ROOT_DIR/packages/flutter_monitor_sdk/example"
SERVER_PORT="${FM_SERVER_PORT:-3000}"

usage() {
  cat <<'EOF'
Usage: bash scripts/run_example.sh [--server-url URL] [--local-server] [flutter run args...]

Options:
  --server-url URL   Send full JSON envelopes to this monitor endpoint.
  --local-server     Use the current Mac LAN IP and /api/monitor/v1/events.

Examples:
  bash scripts/node_server.sh start
  bash scripts/run_example.sh --local-server
  bash scripts/run_example.sh --server-url http://192.168.1.10:3000/api/monitor/v1/events
EOF
}

detect_host_ip() {
  ipconfig getifaddr en0 2>/dev/null ||
    ipconfig getifaddr en1 2>/dev/null ||
    hostname -I 2>/dev/null | awk '{print $1}'
}

MONITOR_SERVER_URL=""
FLUTTER_ARGS=()

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
    --local-server)
      HOST_IP="$(detect_host_ip)"
      if [ -z "$HOST_IP" ]; then
        echo "Could not detect host IP. Use --server-url explicitly." >&2
        exit 1
      fi
      MONITOR_SERVER_URL="http://$HOST_IP:$SERVER_PORT/api/monitor/v1/events"
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

cd "$EXAMPLE_DIR"
fvm flutter run "${FLUTTER_ARGS[@]}"
