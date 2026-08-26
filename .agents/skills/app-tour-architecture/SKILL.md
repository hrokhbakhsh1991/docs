---
name: app-tour-architecture
description: >
  app-tour monorepo boundaries, workspace plugins, verification fast-track, and
  Codebase Memory project names. Use when adding packages, touching
  workspace-sdk / platform-core / apps/api, importing across workspaces,
  writing guards, or deciding which tests to run.
---

# app-tour architecture

Platform logic = generic. Workspace logic = injectable. Do not copy Denali into core.

## Layout

| Path | Role |
|------|------|
| `packages/workspace-sdk` | Plugin contract. No workspace or `legacy/` imports. |
| `packages/platform-core` | Generic engine. Same import ban. |
| `packages/workspaces/<id>` | Tenant/workspace-specific code only. |
| `apps/api` `apps/web` `apps/portal` `apps/marketing` | Host surfaces. |
| `legacy/` | Frozen Tour Ops. Reference only. No new features. |

## Hard rules

1. `workspace-sdk` and `platform-core` must not import `packages/workspaces/*` or `legacy/`.
2. New workspace = `pnpm run workspace:create -- <id>` then `pnpm run generate:workspace-registry`.
3. Wizard state: canonical document is source of truth (no RHF mirror).
4. Doc-first: before changing `packages/platform-core`, `workspace-sdk`, or `apps/api`, update the matching Markdoc under `docs/`. Say `Updating documentation for this change` first.
5. After code changes append: `Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL].`

## Verification (never full gates unless user says YES)

Prefer under 5 minutes:

```bash
pnpm run pre-commit:fast && pnpm run guard:import-boundary
pnpm run test:changed
```

Forbidden without explicit **YES** / "Full Integrity Check":
`phase-5:gate`, `phase-6:gate`, `test:full`, `ci:integrity`, nested `phase-0`…`phase-4:gate`.

## Codebase Memory projects

`/workspace` cannot be one index root. Use:

| Work | `project` |
|------|-----------|
| SDK / workspaces / tokens | `app-tour-packages` |
| api / web / portal / marketing | `app-tour-apps` |
| docs | `app-tour-docs` |
| guards / scripts | `app-tour-scripts` |
| SQL / compose | `app-tour-infra` |

`search_graph` / `trace_path` / `get_architecture` before grep. CLI if MCP missing: `codebase-memory-mcp cli …`.

## Standards

- WRS-001: `docs/standards/workspace-routing-standard.mdoc` — no `shop.*` egress in app src.
- PCMS-001: `docs/standards/member-session-portal-authority.mdoc` — portal owns member session.

## Skills to pair

- Prisma work → `prisma-client-api` / `prisma-cli`
- Next/React perf → `vercel-react-best-practices`
- Playwright specs → `playwright-best-practices` (Playwright MCP already in Cloud Agents)
- UI/tokens → existing `design-system` / `ui-styling` (do not add more design packs)
