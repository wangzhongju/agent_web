#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_HELPER="${SCRIPT_DIR}/docker-compose-frontend.sh"

usage() {
  cat <<'EOF'
Usage: docker/docker.sh <command> [args...]

Quick commands:
  build               Build the frontend image
  up                  Create/start the frontend container without building
  start               Create/start the frontend container without building
  stop                Stop the frontend container
  restart             Restart the frontend container
  down                Remove the frontend container
  status              Show container status
  logs                Show frontend logs
  exec <cmd...>       Execute any command in the frontend container
EOF
}

COMMAND="${1:-}"
if [[ -z "${COMMAND}" ]]; then
  usage
  exit 1
fi
shift || true

case "${COMMAND}" in
  build|up|start|stop|restart|down|logs|exec)
    "${COMPOSE_HELPER}" "${COMMAND}" "$@"
    ;;
  status|ps)
    "${COMPOSE_HELPER}" ps
    ;;
  *)
    usage
    exit 1
    ;;
esac
