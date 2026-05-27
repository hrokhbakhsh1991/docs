import assert from "node:assert/strict";
import test from "node:test";

import { isMeaningfulDenaliDraftSnapshot } from "./denali-adapter";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

test("isMeaningfulDenaliDraftSnapshot returns false for empty baseline draft", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    false,
  );
});

test("isMeaningfulDenaliDraftSnapshot returns true for progressed step", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 1,
    }),
    true,
  );
});

test("isMeaningfulDenaliDraftSnapshot returns true for meaningful form data", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Denali test title";
  assert.equal(
    isMeaningfulDenaliDraftSnapshot({
      form,
      currentStepIndex: 0,
    }),
    true,
  );
});
