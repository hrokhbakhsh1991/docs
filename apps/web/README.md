# @apps/web

Phase **3.3+** thin Next.js shell — **Phase 4** per-request tenant theme fetch ([`phase-4-tenant-kernel.md`](../../docs/phase-4-tenant-kernel.md)).

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
```

Phase: **3.3**
