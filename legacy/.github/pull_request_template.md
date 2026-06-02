## Platform migration (if applicable)

- **Phase:** `Phase: _._` (e.g. `Phase: 0.1`, `Phase: 1.2`) — required for structural / wizard / workspace changes
- **Map:** [map.md](map.md) · Phase 0 detail: [phase-0-platform-baseline.md](phase-0-platform-baseline.md)
- [ ] Work is scoped to a phase in the map (or map updated in a prior PR)

## Backend Freeze Pre-Checklist (must be fully checked)

- [ ] `docs/backend-freeze-pr-checklist.md` کامل بررسی و تیک شده است.
- [ ] هیچ مورد باز از `TODO(FREEZE-BLOCKER)` باقی نمانده است.

## E2E results (paste output)

```text
# خروجی کامل یا خلاصه دستورات E2E را اینجا paste کنید.
```

## Runtime DI validation

- وضعیت resolve شدن providerها:
- ماژول/کنترلرهایی که بررسی شدند:
- اگر خطای `undefined injection` دیده شد، جزئیات:

## Swagger alignment confirmation

- [ ] Swagger/OpenAPI regenerate شده است.
- [ ] schema خالی وجود ندارد.
- [ ] response shapeها با DTO/runtime یکسان هستند.

## Reviewer Notes

- نکات ریسک:
- موارد نیازمند پیگیری:
- تایید نهایی reviewer:

---

### UI Preview

You MUST review the UI Playground before merging.

Preview URL: `/ui-playground` (open on the Vercel Preview deployment for this PR).

### UI Impact

- [ ] No visual changes
- [ ] Component update
- [ ] Token update
