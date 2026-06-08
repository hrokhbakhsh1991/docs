# ASM-9.2 — Admin shell session states

```yaml
map_id: AGENT-STATE-MAP-9.2
subphase: "9.2"
authority: subphases/9.2-admin-shell.md · ADMIN-SHELL-UX.md · CANLOAD-OPERATOR-SESSION.contract.ts
state_count: 14
decisions: [DEC-P9-013]
```

## States

| State ID    | Trigger                             | Guard                         | Next                    | Log signature                  |
| ----------- | ----------------------------------- | ----------------------------- | ----------------------- | ------------------------------ |
| ASM-9.2-001 | GET `(app)/dashboard` anon          | `requireOperatorSession` deny | redirect `/auth/login`  | `operator.session.missing`     |
| ASM-9.2-002 | GET `(app)/dashboard` valid session | allow                         | 200 dashboard           | `operator.shell.render`        |
| ASM-9.2-003 | Layout render                       | `force-dynamic` export        | nav landmarks           | `operator.layout.dynamic`      |
| ASM-9.2-004 | Nav click Tours                     | session valid                 | `(app)/tours` or stub   | `operator.nav.tours`           |
| ASM-9.2-005 | Nav click Users                     | session valid                 | `(app)/users` stub      | `operator.nav.users`           |
| ASM-9.2-006 | Nav click Bookings                  | session valid                 | `(app)/bookings` stub   | `operator.nav.bookings`        |
| ASM-9.2-007 | Nav click Settings                  | session valid                 | `(app)/settings` stub   | `operator.nav.settings`        |
| ASM-9.2-008 | Nav click Finance                   | denali workspace              | `(app)/finance` or hide | `operator.nav.finance`         |
| ASM-9.2-009 | Nav click Finance                   | urban workspace               | hidden / 404            | `operator.nav.finance.denied`  |
| ASM-9.2-010 | Session expired mid-nav             | cookie invalid                | redirect login          | `operator.session.expired`     |
| ASM-9.2-011 | Static import denali in layout      | lint/guard                    | **FAIL** P9-F-003       | `operator.shell.static-import` |
| ASM-9.2-012 | Theme hydrate                       | tenant API                    | branded shell           | `operator.theme.loaded`        |
| ASM-9.2-013 | Mobile menu toggle                  | viewport `<768px`             | drawer open/close       | `operator.shell.drawer`        |
| ASM-9.2-014 | New tour CTA                        | admin/owner                   | GET `/tours/new`        | `operator.nav.new-tour`        |

## Spec bindings

| State ID    | Test case                                 |
| ----------- | ----------------------------------------- |
| ASM-9.2-001 | WEB-9.2-01 · `admin-shell-access.spec.ts` |
| ASM-9.2-002 | WEB-9.2-02 · `dashboard-smoke.spec.ts`    |
| ASM-9.2-011 | AH-9.2-04 · CP-9.2-04                     |
| ASM-9.2-013 | WEB-9.2-04 · CP-9.2-05                    |
| ASM-9.2-014 | CP-9.2-09 · DEC-P9-007                    |
