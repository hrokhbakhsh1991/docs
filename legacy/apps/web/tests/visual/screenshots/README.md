# VRT baseline snapshots

PNG baselines live next to this folder (see `snapshotDir` in `playwright.config.ts`). Typical layout:

`visual/ui-playground.spec.ts-snapshots/*.png` (suffix may include `-chromium-linux`).

## Generate / update baselines

From repo root:

```bash
pnpm --dir apps/web run build
pnpm --dir apps/web exec playwright test --update-snapshots
```

If Playwright cannot download Chromium (CDN timeout), use an installed Chrome:

```bash
PLAYWRIGHT_CHANNEL=chrome pnpm --dir apps/web exec playwright test --update-snapshots
```

Commit updated files under `tests/visual/screenshots/`.

**Tip:** CI uses Ubuntu + bundled Chromium; generating baselines in a matching environment avoids pixel drift.
