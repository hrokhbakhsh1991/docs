#!/usr/bin/env node
/**
 * DEC-080 — fail gate early when Postgres is not configured.
 * @see docs/phase-5/appendices/postgres-required-gates.md
 */

/**
 * @param {{ gateName: string, requireAdmin?: boolean }} options
 * @returns {{ databaseUrl: string, databaseUrlAdmin?: string }}
 */
export function requireGateDatabase({ gateName, requireAdmin = false }) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(`${gateName}: FAIL — DATABASE_URL is required (DEC-080).`);
    console.error("  Start Postgres: docker compose -f docs/phase-4/dev/docker-compose.yml up -d");
    console.error(
      "  Export: DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'"
    );
    console.error(
      "  See: docs/phase-4/ci.md and docs/phase-5/appendices/postgres-required-gates.md"
    );
    process.exit(1);
  }

  const databaseUrlAdmin = process.env.DATABASE_URL_ADMIN?.trim();
  if (requireAdmin && !databaseUrlAdmin) {
    console.error(`${gateName}: FAIL — DATABASE_URL_ADMIN is required.`);
    process.exit(1);
  }

  if (!databaseUrlAdmin) {
    console.warn(
      `${gateName}: warn — DATABASE_URL_ADMIN unset; admin specs use CI fallback default`
    );
  }

  const storageDriver = process.env.STORAGE_DRIVER?.trim();
  if (storageDriver && storageDriver !== "prisma") {
    console.warn(
      `${gateName}: warn — STORAGE_DRIVER=${storageDriver}; postgres tier steps override to prisma`
    );
  }

  return { databaseUrl, databaseUrlAdmin };
}
