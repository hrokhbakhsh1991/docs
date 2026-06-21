# P3 — Denali Safety Covenant

```yaml
doc_id: P3-DENALI-SAFETY
version: 1.2-aligned
status: mandatory-for-all-P3-work
extends: TEMP/p2/p2-denali-safety.md
agent_entry: TEMP/p3/AGENT-START.md
current_task: —
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · Facts [AGENT-CONTEXT.md](./AGENT-CONTEXT.md) · Tasks [AGENT-MANIFEST.yaml](./AGENT-MANIFEST.yaml) · Loop [AGENT-LOOP.md](./AGENT-LOOP.md) · Map [FILE-MAP.md](./FILE-MAP.md)

---

## یک جمله

> **P3 = metadata-first kernel + package overlay.** DB stores data surfaces only. Package supplies hooks/composites until P3-D cutover. **Field layout SoT (`fieldRegistry`, `ruleSet`, wizard roots) must not change in `packages/workspaces/denali/`** — overlay paths (wizard hooks, theme, manifest HTTP, exports) may change when scoped guard passes.

---

## Guards (every nano)

```bash
pnpm run guard:p3-denali-covenant
pnpm run guard:import-boundary
```

`guard:p3-denali-covenant` replaces blunt `git diff --quiet packages/workspaces/denali`. It **FAIL**s on metadata SoT paths and **PASS**es on overlay paths listed below.

---

## Denali diff policy (scoped)

| Forbidden (metadata SoT) | Allowed (overlay / ops) |
|--------------------------|-------------------------|
| `src/field-registry/**` | `README.md` (P3-D maintenance banner) |
| `src/rules/**` (incl. `generated/`) | `package.json` export map |
| `src/composites/**` | `src/wizard/**` |
| `src/denali-plugin-adapter.ts` | `src/draft/**`, `src/photos/**` |
| `src/denali.plugin.ts` | `theme/**`, `tsconfig.json` |
| | `workspace.manifest.json` (HTTP host wiring) |

Implementation: [`scripts/guards/guard-p3-denali-covenant.mjs`](../../scripts/guards/guard-p3-denali-covenant.mjs)

---

## مجاز / ممنوع

| ✅ | ❌ |
|----|-----|
| `apps/api/src/workspace-metadata/*` | `fieldRegistry` / `ruleSet` edits in denali package |
| `packages/workspace-sdk/src/metadata/*` | metadata-only plugin (no overlay) |
| `apps/web/src/wizard/platform/*` (P3-B) | `denali/ui` in `apps/web/src/platform` |
| `apps/web/src/platform/*` (P3-C) | `WORKSPACE_METADATA_ENABLED=true` prod default |
| Denali overlay paths in scoped guard table | Unguarded edits under forbidden SoT paths |

---

## Integration gate (P3-A-N-011)

When `WORKSPACE_METADATA_ENABLED=true`, production persist uses `validateCanonicalBeforePersist` → `validateCanonicalBeforePersistAsync` (tenant-aware resolve). Sync helper `validateCanonicalBeforePersistSync` remains for worker threads and flag-off dev paths. See [`platform-workspace-cutover.mdoc`](../../docs/phase-16/platform-workspace-cutover.mdoc) §G2.

---

## Links

| Doc | Role |
|-----|------|
| [FILE-MAP.md](./FILE-MAP.md) | Master index |
| [p3-a-workspace-definitions.md](./p3-a-workspace-definitions.md) | Export rules |
| [p3-d-migration-parity.md](./p3-d-migration-parity.md) | Cutover P3-D |
| [../p2/p2-denali-safety.md](../p2/p2-denali-safety.md) | P2 base |
