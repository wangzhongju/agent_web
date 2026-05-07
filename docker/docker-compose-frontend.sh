#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${TEST_WEB_DOCKER_ENV_FILE:-${SCRIPT_DIR}/env.frontend}"
SERVICE_NAME="test-web"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is required but was not found." >&2
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

run_compose() {
  (
    cd "${PROJECT_ROOT}"
    "${COMPOSE_CMD[@]}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
  )
}

usage() {
  cat <<'EOF'
Usage: docker/docker-compose-frontend.sh <command> [args...]

Commands:
  build               Build the frontend image
  up                  Create/start the frontend container without building
  start               Create/start the frontend container without building
  stop                Stop the frontend container
  restart             Restart the frontend container
  down                Stop and remove the frontend container
  ps                  Show compose status
  logs                Tail frontend logs
  exec [cmd...]       Execute a command in the frontend container

Environment overrides:
  TEST_WEB_DOCKER_ENV_FILE Env file for compose (default: docker/env.frontend)
EOF
}

COMMAND="${1:-}"
if [[ -z "${COMMAND}" ]]; then
  usage
  exit 1
fi
shift || true

case "${COMMAND}" in
  build)
    run_compose build "${SERVICE_NAME}"
    ;;
  up|start)
    run_compose up -d --no-build "${SERVICE_NAME}"
    ;;
  stop)
    run_compose stop "${SERVICE_NAME}"
    ;;
  restart)
    run_compose restart "${SERVICE_NAME}"
    ;;
  down)
    run_compose down
    ;;
  ps|status)
    run_compose ps
    ;;
  logs)
    run_compose logs -f "${SERVICE_NAME}"
    ;;
  exec)
    if [[ "$#" -eq 0 ]]; then
      run_compose exec "${SERVICE_NAME}" sh
    else
      run_compose exec "${SERVICE_NAME}" "$@"
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac
