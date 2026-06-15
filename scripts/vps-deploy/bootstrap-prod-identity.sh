#!/usr/bin/env bash
# One-time / idempotent prod bootstrap: Denali tenant row + operator owner identity.
# ProvisioningService is dev-gated — seed runs with NODE_ENV=development override only here.
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "bootstrap-prod-identity: missing $ENV_FILE" >&2
  exit 1
fi

cd "$DEPLOY_PATH/apps/api"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

NODE_ENV=development pnpm exec tsx -e "
import { ProvisioningService } from './src/internal/provisioning.service.ts';
import { seedDenaliOperatorIdentity } from './scripts/seed-denali-operator-identity.ts';
new ProvisioningService()
  .seedDenaliSmokeTenant()
  .then(() => seedDenaliOperatorIdentity())
  .then(() => { console.log('bootstrap-prod-identity: OK'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
"
