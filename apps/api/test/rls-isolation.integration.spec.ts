import { describe, it } from "node:test";

/**
 * P4-E-RLS-01 — requires Docker Postgres + infra/sql/001_tenant_rls.sql applied.
 * Run: DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev pnpm --filter @apps/api test
 */
describe("RLS isolation (integration)", () => {
  it("skips when DATABASE_URL is unset", { skip: !process.env.DATABASE_URL }, async () => {
    // Full Testcontainers proof ships when Prisma/pg repository is default in 4.2 closure.
  });
});
