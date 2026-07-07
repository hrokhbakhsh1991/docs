import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogCancellationLines } from "../src/catalog/format-catalog-cancellation";

describe("format-catalog-cancellation", () => {
  it("MKT-27 builds deadline and penalty lines from Denali card fields", () => {
    const lines = buildCatalogCancellationLines(
      {
        id: "1",
        policiesText: "No refunds after deadline.",
        cancellationDeadlineHours: 48,
        cancellationPenaltyPercentage: 25,
      },
      {
        deadline: "Deadline: {hours}h",
        penalty: "Penalty: {percent}%",
      }
    );
    assert.deepEqual(lines, ["Deadline: 48h", "Penalty: 25%"]);
  });

  it("MKT-28 omits missing cancellation fields", () => {
    const lines = buildCatalogCancellationLines(
      { id: "1" },
      { deadline: "Deadline: {hours}h", penalty: "Penalty: {percent}%" }
    );
    assert.deepEqual(lines, []);
  });
});
