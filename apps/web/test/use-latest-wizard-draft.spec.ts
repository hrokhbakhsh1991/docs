import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit } from "../src/wizard/use-latest-wizard-draft";

describe("use-latest-wizard-draft.spec.ts", () => {
  it("WEB-WIZ-DRAFT-REF-01 commitWizardDraftEdit applies onto latest ref snapshot", () => {
    const draftRef = { current: emptyTourWizardDraft() };
    const seen: string[] = [];
    const onDraftChange = (next: ReturnType<typeof emptyTourWizardDraft>) => {
      seen.push(getCanonicalStringValue(next, "title"));
    };

    draftRef.current = setCanonicalStringValue(draftRef.current, "title", "Latest");
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "title", "Edited")
    );

    assert.deepEqual(seen, ["Edited"]);
    assert.equal(getCanonicalStringValue(draftRef.current, "title"), "Edited");
  });
});
