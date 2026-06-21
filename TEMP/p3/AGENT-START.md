# P3 — AI Agent Entry (READ THIS FIRST)

```yaml
doc_id: P3-AGENT-START
version: 1.2-aligned
mandatory: true
current_task: P3-C-N-001
current_epic: P3-A
next_task: P3-A-N-012
then_task: P3-B-N-001
nano_total: 52
nano_done: 26
file_map: TEMP/p3/FILE-MAP.md
```

> **🤖 AI:** Entry [AGENT-START.md](./AGENT-START.md) · Facts [AGENT-CONTEXT.md](./AGENT-CONTEXT.md) · Tasks [AGENT-MANIFEST.yaml](./AGENT-MANIFEST.yaml) · Loop [AGENT-LOOP.md](./AGENT-LOOP.md)

---

## ⚠️ AI — 15 قانون طلایی (نقض = STOP)

| # | Rule |
|---|------|
| R1 | **فقط یک nano** — فعلی: **`P3-A-N-011`** |
| R2 | **Read order:** START → CONTEXT → MANIFEST → epic spec |
| R3 | **فقط فایل‌های manifest** — دیگر = STOP |
| R4 | **IMPLEMENT قبل از TEST** |
| R5 | **Facts frozen** — re-explore ممنوع |
| R6 | **`git diff packages/workspaces/denali` خالی** |
| R7 | **min 2 assert** — `assert.ok(true)` ممنوع |
| R8 | **Doc-first** for sdk/platform-core/api |
| R9 | **VERIFY قرمز → STOP** |
| R10 | **Payload data-only** |
| R11 | **Wizard = WorkspaceWizardSurface** |
| R12 | **Adapter = package overlay merge** |
| R13 | **No denali/ui in src/platform** |
| R14 | **No heavy gates** without Architect YES |
| R15 | **After nano:** update FILE-MAP §Sync checklist |

---

## مسیر خواندن

```text
1. THIS FILE
2. AGENT-CONTEXT.md
3. AGENT-MANIFEST.yaml  → confirm deps done
4. AGENT-LOOP.md
5. p3-denali-safety.md
6. epic spec for current_epic
7. docs/phase-16/*.mdoc (doc-first)
```

---

## Task فعال: `P3-A-N-011`

| Field | Value |
|-------|-------|
| Epic | P3-A |
| Spec | [p3-a-workspace-definitions.md](./p3-a-workspace-definitions.md) § NANO TASKS — DETAIL |
| Goal | Wire `resolveWorkspacePluginForTenantContext` into production ingress |
| Next | P3-A-N-012 → then P3-B-N-001 |

---

## EPIC map

| EPIC | Nano | Done | Status | Spec |
|------|------|------|--------|------|
| P3-A | 12 | 10 | in_progress | p3-a-workspace-definitions.md |
| P3-B | 14 | 0 | planned | p3-b-generic-widgets.md |
| P3-C | 14 | 0 | planned | p3-c-workspace-builder.md |
| P3-D | 12 | 0 | optional | p3-d-migration-parity.md |

Order: **P3-A → P3-B → P3-C → P3-D** (frozen)

---

## VERIFY (always)

```bash
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
pnpm --filter @apps/api exec node --test \
  test/workspace-metadata-loader.spec.ts \
  test/workspace-definition-export.spec.ts \
  test/workspace-definition-tenant-binding.spec.ts
```

---

## STOP

| Symptom | Action |
|---------|--------|
| Wrong nano / skip ahead | STOP |
| File not in manifest | STOP |
| wizard steps/surfaces in JSON | STOP |
| Edit denali | STOP |
| P3-B before N-012 | STOP |

---

## Links

| Doc | Path |
|-----|------|
| File map | [FILE-MAP.md](./FILE-MAP.md) |
| Context | [AGENT-CONTEXT.md](./AGENT-CONTEXT.md) |
| Manifest | [AGENT-MANIFEST.yaml](./AGENT-MANIFEST.yaml) |
| Loop | [AGENT-LOOP.md](./AGENT-LOOP.md) |
| Index | [README.md](./README.md) |
| Roadmap | [../ROADMAP-INDEX.md](../ROADMAP-INDEX.md) |
