import assert from "node:assert/strict";
import test from "node:test";

import { flattenDenaliFormErrors } from "./flattenDenaliFormErrors";

test("flattenDenaliFormErrors expands nested itinerary errors", () => {
  const flat = flattenDenaliFormErrors({
    programNature: {
      itinerary: [
        { activities: { message: "حداقل یک فعالیت برای هر روز الزامی است.", type: "custom" } },
      ],
    },
  } as never);

  assert.equal(flat.length, 1);
  assert.equal(flat[0]!.path, "programNature.itinerary.0.activities");
});
