# P2 — Enterprise Ops (summary)

```yaml
phase: P2
version: 2.0-aligned
status: planned
prerequisite: P1 ✅ — TEMP/p1-exit-checklist.md
north_star: Super Admin @ admin.{PLATFORM_ROOT_DOMAIN}
denali: TEMP/p2/p2-denali-safety.md (mandatory)
detail_index: TEMP/p2/README.md
exit: TEMP/p2-exit-checklist.md
estimate: 4–8 weeks
nano_tasks_total: 142
```

> **Alias کوتاه.** Spec اجرایی = `TEMP/p2/p2-*.md` (nano-task). این فایل فقط نقشه است.

---

## شروع فاز ۲ (۳ قدم)

1. **P1 exit** — [p1-exit-checklist.md](./p1-exit-checklist.md)
2. **Covenant** — [p2/p2-denali-safety.md](./p2/p2-denali-safety.md)
3. **Agent** — [p2/README.md](./p2/README.md) → **P2-B-N-001**

---

## ترتیب EPIC (frozen)

```text
P2-B → P2-C → P2-D → P2-E → P2-A
 core    core    core    core    low (last)
```

| # | EPIC | Nano | Start → Stop | Super Admin surface |
|---|------|------|--------------|---------------------|
| 1 | P2-B Impersonation | 30 | P2-B-N-001 → N-030 | Owner tab · view-as-club |
| 2 | P2-C Billing | 32 | P2-C-N-001 → N-032 | Billing tab |
| 3 | P2-D Domains/SSL | 32 | P2-D-N-001 → N-032 | Domains tab · SSL KPI |
| 4 | P2-E Offboard | 32 | P2-E-N-001 → N-032 | Actions · Danger zone · Audit CSV |
| 5 | P2-A Gateway | 16 | P2-A-N-001 → N-016 | marketing apex (optional) |

**Dependencies:** P2-D after P2-C (custom_domain gate) · P2-E after P2-D (optional SSL revoke on purge) · P2-A after all core.

---

## P1 done vs P2 to build

| Area | P1 | P2 |
|------|----|----|
| Platform API | auth · RBAC · provision · domains CRUD · audit | impersonate · billing · SSL · offboard · export |
| Super Admin UI | 5 club tabs · audit list | +Billing · impersonate · danger · SSL badges |
| Denali package | isolated | **no edits** |
| Mother site | smoke tenant fallback | gateway stub (P2-A) |

---

## Spec files

| EPIC | File | Version |
|------|------|---------|
| Covenant | [p2/p2-denali-safety.md](./p2/p2-denali-safety.md) | mandatory |
| Index | [p2/README.md](./p2/README.md) | 2.0 |
| P2-A | [p2/p2-a-platform-mother-site.md](./p2/p2-a-platform-mother-site.md) | 1.0-nano · 16 tasks |
| P2-B | [p2/p2-b-support-impersonation.md](./p2/p2-b-support-impersonation.md) | 2.0-nano · 30 tasks |
| P2-C | [p2/p2-c-billing-plans.md](./p2/p2-c-billing-plans.md) | 2.1-nano · 32 tasks |
| P2-D | [p2/p2-d-domain-ssl-automation.md](./p2/p2-d-domain-ssl-automation.md) | 2.2-nano · 32 tasks |
| P2-E | [p2/p2-e-offboard-compliance.md](./p2/p2-e-offboard-compliance.md) | 2.3-nano · 32 tasks |

→ Exit: [p2-exit-checklist.md](./p2-exit-checklist.md) · Next: [P3](./p3-metadata-platform.md)
