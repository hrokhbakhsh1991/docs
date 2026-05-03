# Vercel Preview & UI Playground

This monorepo’s Next.js app lives in **`apps/web`**. Vercel does **not** use a root `vercel.json` `projects` array; each Git-linked Project sets **Settings → General → Root Directory** to the app folder (here: `apps/web`).

## What to configure in Vercel

1. **Root Directory:** `apps/web`
2. **Framework preset:** Next.js (auto-detected).
3. **`apps/web/vercel.json`** sets `installCommand` to run `pnpm install` from the repository root so workspace dependencies resolve.

Every **Pull Request** that touches the linked project gets a **Preview Deployment**. The deployment URL is posted on the PR by Vercel (Git integration).

## UI Playground for design / QA

After deploy, open:

**`https://<preview-deployment-url>/ui-playground`**

- Filesystem location: `apps/web/app/ui-playground/` (Next.js App Router uses `app/`, not `src/app/`, in this project).
- Purpose: internal component preview, token sanity, light/dark checks — not end-user product UI.
