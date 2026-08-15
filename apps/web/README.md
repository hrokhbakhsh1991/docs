# @apps/web

Phase **3.3+** thin Next.js shell — **Phase 4** per-request tenant theme fetch ([`phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md)).

## Operator admin login

The `(app)/**` operator panel is **invite-only**:

- **Login:** `/auth/login` (alias `/login`) — phone + OTP
- **No self-registration:** `/auth/register` redirects to login with an invite-only notice
- **New operators:** owner/admin invite → `/auth/invite/[token]` → sign in

See [`docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md`](../../docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md).

**Workspace isolation (dev):** use host-specific URLs — e.g. `http://denali.localhost:3000` for Denali. Session JWT `tenant_id` must match the host; a Denali login cannot open `operator.localhost` or `urban.localhost` admin routes.

## Central documentation

| Doc | Link |
|-----|------|
| **Phase 4 guide** | [`docs/phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md) · [Markdoc](../../docs/phase-4-tenant-kernel.mdoc) |
| **Phase 3 guide** | [`docs/phase-3-design-system.md`](../../docs/phase-3-design-system.md) · [Markdoc](../../docs/phase-3-design-system.mdoc) |
| Forensic audit | [`docs/audits/phase-3-zero-debt-forensic-audit.md`](../../docs/audits/phase-3-zero-debt-forensic-audit.md) |
| Integrity report | [`docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc`](../../docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc) |
| Migration map | [`docs/MIGRATION-MAP.md`](../../docs/MIGRATION-MAP.md) |

## Import boundary (mandatory)

Every `dev`, `build`, and `lint` runs **before** Next.js:

- `scripts/guards/import-boundary-ast.mjs` — AST barrel ban on `@app-tour/ui-primitives`
- `scripts/guards/audit-ui-primitives-boundary.mjs` — ripgrep consumer audit

Use **subpaths only**, e.g. `@app-tour/ui-primitives/button` (see `src/shell/home-shell.tsx`).

## Commands

```bash
# From repo root (build packages first)
pnpm build
pnpm install
pnpm --filter @apps/web dev
pnpm --filter @apps/web run test:e2e:operator
pnpm --filter @apps/web run test:e2e:prepayment
```

`test:e2e:prepayment` is the dedicated Denali wizard prepayment smoke. It runs
`denali-prepayment-create.spec.ts` through [`playwright.prepayment.config.ts`](./playwright.prepayment.config.ts)
and forces non-finance smoke bootstrap (`OPERATOR_SMOKE_USE_DATABASE=0`) so the
scenario stays independent from the wider DB-backed operator finance pack.

Phase: **3.3**
