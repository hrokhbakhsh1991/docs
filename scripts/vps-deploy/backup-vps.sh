#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${APP_TOUR_BACKUP_ROOT:-/var/backups/app-cloud/daily}"
RETENTION_DAYS="${APP_TOUR_BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_ROOT}/${STAMP}"
mkdir -p "${TARGET}/postgres" "${TARGET}/minio"
chmod 700 "${TARGET}"

backup_env() {
  local label="$1" env_file="$2"
  local db_url bucket access secret
  db_url="$(sed -n 's/^DATABASE_URL_ADMIN=//p' "${env_file}")"
  db_url="$(printf '%s' "${db_url}" | sed -E 's/[?&]connection_limit=[^&]*//')"
  bucket="$(sed -n 's/^MINIO_BUCKET=//p' "${env_file}")"
  access="$(sed -n 's/^MINIO_ACCESS_KEY=//p' "${env_file}")"
  secret="$(sed -n 's/^MINIO_SECRET_KEY=//p' "${env_file}")"
  [[ -n "${db_url}" && -n "${bucket}" && -n "${access}" && -n "${secret}" ]]

  pg_dump --format=custom --file="${TARGET}/postgres/${label}.dump" "${db_url}"
  mc alias set "app-tour-backup-${label}" http://127.0.0.1:9002 "${access}" "${secret}" --api S3v4 >/dev/null
  mc mirror --overwrite "app-tour-backup-${label}/${bucket}" "${TARGET}/minio/${label}/${bucket}"
}

backup_env production /etc/app-tour/api.env
backup_env staging /etc/app-tour-staging/api.env

find "${TARGET}" -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > "${TARGET}/SHA256SUMS"
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -exec rm -rf -- {} +

echo "backup complete: ${TARGET}"
