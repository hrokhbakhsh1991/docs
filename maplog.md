# EXECUTIVE REFACTOR DIRECTIVE: PHASE 11.7 FINAL OPTIMIZATION (P2)
You must implement the final P2 optimization passes and test configurations. Ensure map.md and map.log are completely untouched. Return your technical execution summary here in the chat.

---

## TASK 11.7.1: Smart Auto-Retry on 409 Self-Conflicts (فرانت‌ئند - شبکه)
* **Target File**: `apps/web/src/features/tours/wizard/hooks/useTourWizardServerSync.ts`
* **Technical Specification**:
    - Inside the 409 error catcher block, when a `TOUR_WIZARD_DRAFT_STALE` error is caught, perform a quick background fetch of the server draft state before showing the conflict UI modal.
    - If the server's current `version === expectedLocalVersion + 1` AND a structural fingerprint comparison confirms no other active user/device has altered the payload content, automatically synchronize the local version integer counter to match the server state and trigger a seamless retry PATCH immediately without disturbing the user with an error prompt.

## TASK 11.7.2: Implement Explicit Minimal-Legacy Unit Test for Cloner (تست فرانت)
* **Target File**: `apps/web/src/features/tours/clone/__tests__/transformTourToDenaliWizardValues.spec.ts` (or your exact spec location)
* **Technical Specification**:
    - Add an explicit new test case: `"should successfully transform legacy minimal tours with completely empty photosData, dayPlans, and missing map zones"`.
    - Assert that the transformation loop safely assigns clean default fallback boundaries instead of failing on null object reference exceptions.

## TASK 11.7.3: final Build Pass Verification
* **Action**: Run `pnpm exec tsc --noEmit` and confirm all 618+ web and 545+ api specs pass perfectly.