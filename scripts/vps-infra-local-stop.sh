#!/usr/bin/env bash
# Stop local Docker infra replaced by VPS (Postgres / Redis / MinIO).
set -euo pipefail

CONTAINERS=(
  app-tour-minio
  app-tour-redis
  app-tour-postgres
  app-tour-phase4-postgres
)

stopped=0
for name in "${CONTAINERS[@]}"; do
  if docker ps -q -f "name=^/${name}$" | grep -q .; then
    echo "Stopping ${name}..."
    docker stop "${name}" >/dev/null
    stopped=$((stopped + 1))
  fi
done

if [[ "${stopped}" -eq 0 ]]; then
  echo "No app-tour infra containers were running."
else
  echo "Stopped ${stopped} local infra container(s). Data volumes kept."
fi
