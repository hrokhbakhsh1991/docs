# EXECUTIVE E2E SCHEMATIC GAP RECOVERY DIRECTIVE (PHASE 14.5)
You must completely eliminate the 18 pre-existing E2E test failures caused by missing schema columns and migration drifts. Do not touch map.md or map.log.

---

## TASK 14.5.1: Repair Missing `workspace_invites.token` Schema (ترمیم جدول دعوت‌نامه‌ها)
* **Target Files**:
    - `apps/api/src/database/migrations/` (Create a new dedicated repair migration)
    - `apps/api/src/modules/workspaces/entities/workspace-invite.entity.ts`
* **Technical Specification**:
    - Generate a concrete migration `1777600400000-RepairWorkspaceInvitesTokenColumn.ts`.
    - Check if the column `token` (varchar 255 / text, nullable or not based on entity) is missing from `workspace_invites`. Add it explicitly via raw query or QueryRunner.
    - Add a strict unique index on `("tenant_id", "token")` to guarantee referential safety.

## TASK 14.5.2: Execute & Force Complete E2E Quality Gate (سبز کردن سرتاسری لایه تست)
* **Action**: 
    - Run the database migrations locally for the test environment.
    - Run `pnpm --filter @apps/api exec jest test/api.e2e-spec.ts --runInBand --forceExit`.
* **Constraint**: Ensure the API E2E test suite drops from 18 failures to **EXACTLY 0 failures** ($121 + 18 = 139$ total passing specs).