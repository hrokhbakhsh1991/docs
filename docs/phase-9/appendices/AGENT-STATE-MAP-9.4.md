# ASM-9.4 — Users & invites states

```yaml
map_id: AGENT-STATE-MAP-9.4
subphase: "9.4"
state_count: 18
decisions: [DEC-P9-008, DEC-P9-015]
authority: USERS-DIRECTORY-UX.md
```

| State ID    | Trigger                         | Guard                | Next                |
| ----------- | ------------------------------- | -------------------- | ------------------- |
| ASM-9.4-001 | GET /users admin                | isAdminOrOwner       | 200 list            |
| ASM-9.4-002 | GET /users member               | deny directory       | **403**             |
| ASM-9.4-003 | POST /users/invite member actor | deny                 | **403** P9-F-005    |
| ASM-9.4-004 | POST /users/invite admin actor  | isAdminOrOwner       | 201                 |
| ASM-9.4-005 | POST invite role=viewer         | DEC-P9-015           | **400**             |
| ASM-9.4-006 | PATCH role grant owner          | forbidden            | **403**             |
| ASM-9.4-007 | Accept invite token             | token valid          | UserTenant created  |
| ASM-9.4-008 | Cross-tenant invite             | deny                 | **403**             |
| ASM-9.4-009 | Urban admin on owner surface    | assertWorkspaceOwner | **403** RULE-P9-002 |
| ASM-9.4-010 | Directory UI render admin       | isAdminOrOwner       | `(app)/users`       |
| ASM-9.4-011 | Directory UI render member      | !isAdminOrOwner      | locked panel        |
| ASM-9.4-012 | SMK-P9-03 complete              | E2E                  | member in roster    |
| ASM-9.4-013 | DELETE /users/{id} self         | deny                 | **403**             |
| ASM-9.4-014 | DELETE /users/{id} owner target | deny                 | **403**             |
| ASM-9.4-015 | CSV export filtered roster      | client               | download            |
| ASM-9.4-016 | Rewards modal PATCH             | isAdminOrOwner       | **200**             |
| ASM-9.4-017 | Hydrate legacy leader           | normalize            | role=admin          |
| ASM-9.4-018 | sessionVersion bump             | role PATCH           | old JWT **401**     |

Spec: `identity-users.spec.ts` · `users-directory.spec.ts`
