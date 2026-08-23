import { describe, it } from "node:test";

import {
  computeSpotsRemaining,
} from "../../packages/tour-core/src/capacity/spots-remaining.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

describe("spots remaining parity goldens (CW0-06)", () => {
  it("computeSpotsRemaining matches Denali public catalog semantics", () => {
    assertGoldenParity({
      id: "CW0-06-compute-spots",
      fixturePath: fixturePath("spots-remaining/compute-spots.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly cases: readonly {
            readonly totalCapacity: number | null;
            readonly approvedPartySize: number;
            readonly label: string;
          }[];
        }} */ (input);
        return {
          results: typed.cases.map((row) => ({
            label: row.label,
            spotsRemaining: computeSpotsRemaining(
              row.totalCapacity,
              row.approvedPartySize
            ),
          })),
        };
      },
    });
  });
});
