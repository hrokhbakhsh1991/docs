---
name: caveman-commit
description: >
  Always-on commit hygiene. Conventional type + short subject. No essay body
  unless hook/docs require it. Use on every git commit.
---

# caveman-commit

Commits: **normal conventional English**, not caveman fragments.

## Subject

`type(scope): imperative summary` ≤ 72 chars.

Types: `feat` `fix` `docs` `chore` `refactor` `test` `ci`.

## Body

- Only if why is not obvious from subject.
- Max 5 short lines. No changelog dump. No "made with Cursor".
- Docs-guard: mention `docs/` path when protected packages change.

Do not amend/force-push unless user said so.
