# Roadmap Index — app-tour Platform

```yaml
updated: 2026-06-21
p2_status: complete
p3_status: complete
p4_status: complete
p5_status: planned
p5_current_task: P5-A-N-001
p5_agent_entry: TEMP/p5/AGENT-START.md
p5_file_map: TEMP/p5/FILE-MAP.md
p5_index: TEMP/p5/README.md
p5_exit: TEMP/p5-exit-checklist.md
p5_nano: 0/56
p4_current_task: P4-complete
p4_agent_entry: TEMP/p4/AGENT-START.md
p4_file_map: TEMP/p4/FILE-MAP.md
p4_index: TEMP/p4/README.md
p4_exit: TEMP/p4-exit-checklist.md
p4_nano: 48/48
p3_nano: 52/52
```

## مسیر کلی

```text
P0 ✅ → P1 ✅ → P2 ✅ → P3 ✅ → P4 ✅ → P5 ⬜
```

| فاز    | Index                                                                         | وضعیت           |
| ------ | ----------------------------------------------------------------------------- | --------------- |
| P0–P2  | [p2/README.md](./p2/README.md)                                                | ✅              |
| P3     | [p3/README.md](./p3/README.md) · [p3/AGENT-START.md](./p3/AGENT-START.md)     | ✅ complete     |
| **P4** | **[p4/README.md](./p4/README.md)** · [p4/AGENT-START.md](./p4/AGENT-START.md) | **✅ complete** |
| **P5** | **[p5/README.md](./p5/README.md)** · [p5/AGENT-START.md](./p5/AGENT-START.md) | **⬜ planned**  |

---

## P3 EPIC table

| Order | EPIC     | Spec                                                                   | Nano | Done | Status   |
| ----- | -------- | ---------------------------------------------------------------------- | ---- | ---- | -------- |
| 1     | P3-A     | [p3/p3-a-workspace-definitions.md](./p3/p3-a-workspace-definitions.md) | 12   | 12   | complete |
| 2     | P3-B     | [p3/p3-b-generic-widgets.md](./p3/p3-b-generic-widgets.md)             | 14   | 14   | complete |
| 3     | P3-C     | [p3/p3-c-workspace-builder.md](./p3/p3-c-workspace-builder.md)         | 14   | 14   | complete |
| 4     | P3-D     | [p3/p3-d-migration-parity.md](./p3/p3-d-migration-parity.md)           | 12   | 12   | complete |
| —     | Covenant | [p3/p3-denali-safety.md](./p3/p3-denali-safety.md)                     | —    | —    | ✅       |

Summary: [p3-metadata-platform.md](./p3-metadata-platform.md)

---

## P4 EPIC table

| Order | EPIC | Spec                                                               | Nano | Done | Status   |
| ----- | ---- | ------------------------------------------------------------------ | ---- | ---- | -------- |
| 1     | P4-A | [p4/p4-a-catalog-publish.md](./p4/p4-a-catalog-publish.md)         | 12   | 12   | complete |
| 2     | P4-B | [p4/p4-b-portal-registration.md](./p4/p4-b-portal-registration.md) | 14   | 14   | complete |
| 3     | P4-C | [p4/p4-c-club-surfaces.md](./p4/p4-c-club-surfaces.md)             | 12   | 12   | complete |
| 4     | P4-D | [p4/p4-d-product-e2e.md](./p4/p4-d-product-e2e.md)                 | 10   | 10   | complete |

Summary: [p4-club-product-surfaces.md](./p4-club-product-surfaces.md)

**AI entry:** [p4/AGENT-START.md](./p4/AGENT-START.md) · **Verify:** `pnpm run p4:gate` · **Merge blocker:** denali covenant (isolate P0 diff)

---

## P5 EPIC table (post-P4 — planned 2026-06-21)

| Order | EPIC | Spec                                                                           | Nano | Done | Status  |
| ----- | ---- | ------------------------------------------------------------------------------ | ---- | ---- | ------- |
| 1     | P5-A | [p5/p5-a-cutover-pilot.md](./p5/p5-a-cutover-pilot.md)                         | 14   | 0    | planned |
| 2     | P5-B | [p5/p5-b-denali-operator-parity.md](./p5/p5-b-denali-operator-parity.md)       | 16   | 0    | planned |
| 3     | P5-C | [p5/p5-c-workspace-commerce-config.md](./p5/p5-c-workspace-commerce-config.md) | 10   | 0    | planned |
| 4     | P5-D | [p5/p5-d-integrations-plane.md](./p5/p5-d-integrations-plane.md)               | 10   | 0    | planned |
| 5     | P5-E | [p5/p5-e-registrations-finance.md](./p5/p5-e-registrations-finance.md)         | 6    | 0    | planned |

Summary: [p5-enterprise-evolution.md](./p5-enterprise-evolution.md) · Research: [p5/industry-alignment-2026-post-p4.md](./p5/industry-alignment-2026-post-p4.md)

**AI entry:** [p5/AGENT-START.md](./p5/AGENT-START.md) · **First task:** P5-A-N-001 (scoped denali gate)

---

## مسیر کلی (به‌روز)

```text
P0 ✅ → P1 ✅ → P2 ✅ → P3 ✅ → P4 ✅ → P5 ⬜
```

## مراجع

- [p4/FILE-MAP.md](./p4/FILE-MAP.md)
- [p4-exit-checklist.md](./p4-exit-checklist.md)
- [p3-exit-checklist.md](./p3-exit-checklist.md)
- [docs/phase-17/platform-club-product-surfaces.mdoc](./docs/phase-17/platform-club-product-surfaces.mdoc)
- [docs/phase-16/platform-workspace-definitions.mdoc](./docs/phase-16/platform-workspace-definitions.mdoc)
