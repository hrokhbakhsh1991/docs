# Database Migration and Seed Runbook

## Migration command (current)

From repository root:

```bash
pnpm --filter @apps/api migrate:run
```

Equivalent script location: `apps/api/src/scripts/run-migrations.ts`.
Runner: `node --env-file=.env --import tsx`.

## Seed commands (current)

```bash
pnpm --filter @apps/api seed
pnpm --filter @apps/api seed:bulk-test-users
```

Seed runner: `node --env-file=.env --import tsx`.

## Recommended local sequence

```bash
docker compose -f infra/docker-compose.full.yml up -d
pnpm --filter @apps/api migrate:run
pnpm --filter @apps/api seed
```

## OTP-related schema checks

After migrations, verify:

- `users.phone` exists
- `users.is_phone_verified` exists
- SQL function `phone_normalized(text)` exists
- There is no `users.phone_normalized` physical column (normalization is function-based)

## Troubleshooting

- If migration run fails with duplicate migration class names, ensure migration discovery paths are not duplicated in runtime config.
- If tenant-bound e2e setup fails, ensure bootstrap scripts run with valid env and DB context.

## Safety rules

- Do not edit applied migration files.
- Add a new migration for any schema change.
- Keep seed scripts idempotent for reruns.
