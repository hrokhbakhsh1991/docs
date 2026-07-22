import assert from "node:assert/strict";
import test from "node:test";

import { resolveDenaliFieldLabelFromMessages } from "@app-tour/workspace-denali/host/ui/adapters/field-labels-from-messages";

const denaliMessages = {
  steps: {},
  fieldKinds: {},
  tourKinds: {},
  transportModes: {},
  fields: {
    destinationId: "Destination",
    endDateTime: "End date",
  },
} as const;

test("resolveDenaliFieldLabelFromMessages resolves composite renderer ids", () => {
  assert.equal(
    resolveDenaliFieldLabelFromMessages(denaliMessages, "denali.destination"),
    "Destination"
  );
  assert.equal(
    resolveDenaliFieldLabelFromMessages(denaliMessages, "denali.datetime-end"),
    "End date"
  );
});
