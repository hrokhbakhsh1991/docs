#!/bin/bash
set -e

LOG_FILE="map.log"
TEMPLATES_DIR="packages/ci-templates/denali-wizard"

echo "=========================================="
echo "🚀 Running Denali Wizard CI/CD Gates..."
echo "=========================================="
echo "[$(date)] Starting full CI/CD run" >> $LOG_FILE

# Gate 1: Canonical Gate
echo "👉 Gate 1: Canonical Gate..."
node $TEMPLATES_DIR/check-canonical-gate.ts
echo "✅ Canonical Gate PASS"

# Gate 2: Rules Gate
echo "👉 Gate 2: Rules Gate..."
node $TEMPLATES_DIR/check-rules-gate.ts
echo "✅ Rules Gate PASS"

# Gate 3: Normalization Gate
echo "👉 Gate 3: Normalization Gate..."
node $TEMPLATES_DIR/check-normalization-gate.ts
echo "✅ Normalization Gate PASS"

# Gate 4: Projection Gate
echo "👉 Gate 4: Projection Gate..."
node $TEMPLATES_DIR/check-projection-gate.ts
echo "✅ Projection Gate PASS"

# Gate 5: UI Sync Gate
echo "👉 Gate 5: UI Sync Gate..."
node $TEMPLATES_DIR/check-ui-sync-gate.ts
echo "✅ UI Sync Gate PASS"

# Gate 6: Unit Tests
echo "👉 Gate 6: Unit Tests..."
cd apps/web && pnpm test
cd ../../
echo "✅ Unit Tests PASS"

# Gate 7: E2E Tests (Denali Invariants)
echo "👉 Gate 7: E2E Tests..."
cd apps/api && node --import tsx --test test/e2e/denali-negative-invariants.e2e-spec.ts
cd ../../
echo "✅ E2E Tests PASS"

# Summary
echo "=========================================="
echo "🎉 ALL GATES PASSED"
echo "=========================================="
echo "[$(date)] CI/CD run COMPLETED successfully" >> $LOG_FILE

exit 0
