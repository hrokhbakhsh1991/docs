#!/usr/bin/env bash
# Install BFF-first nginx snippet on a Linux host (staging/prod).
# Usage: sudo bash infra/scripts/deploy-nginx-bff-ingress.sh /etc/nginx/sites-available/tour-ops.conf
set -euo pipefail

TARGET="${1:-/etc/nginx/sites-available/tour-ops.conf}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SCRIPT_DIR}/../../docs/infrastructure/nginx-bff-ingress.example.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

if [[ ! -f "${SOURCE}" ]]; then
  echo "Missing ${SOURCE}" >&2
  exit 1
fi

cp "${SOURCE}" "${TARGET}"
nginx -t
echo "Installed ${TARGET}. Reload: systemctl reload nginx"
