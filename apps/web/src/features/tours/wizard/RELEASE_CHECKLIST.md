# Tour Create Wizard — release checklist

- [ ] `pnpm --filter @apps/web run lint` (TypeScript) passes
- [ ] `pnpm --filter @apps/web run test` passes (includes mapper + schema specs)
- [ ] Manual: create flow from `/tours/new` reaches API without `console` errors
- [ ] Manual: «بعدی» blocks on invalid step fields (title length, dates, itinerary)
- [ ] Manual: draft autosave — refresh mid-flow restores form (localStorage `tour-create-wizard-draft-v1`)
- [ ] Manual: success redirects to `/tours` and invalidates list
- [ ] Manual: API/network error shows alert and allows retry
- [ ] Optional: `pnpm --filter @apps/web run eslint` if used in CI
