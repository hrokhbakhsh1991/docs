import { describe, it } from "node:test";

import { sumAcceptedRegistrationSeats } from "../../packages/tour-core/src/capacity/at-create-strategy.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

/**
 * Mirrors `InMemoryBookingsRepository.sumApprovedPartySizeByTourIds` /
 * `sumApprovedPartySizeInTx` — only `approved` rows consume confirmed capacity.
 */
function sumApprovedPartySizeByTourIds(
  tenantId,
  tourIds,
  rows
) {
  if (tourIds.length === 0) {
    return {};
  }
  const tourIdSet = new Set(tourIds);
  /** @type {Record<string, number>} */
  const totals = {};
  for (const row of rows) {
    if (
      row.tenantId !== tenantId ||
      row.status !== "approved" ||
      !tourIdSet.has(row.tourId)
    ) {
      continue;
    }
    totals[row.tourId] = (totals[row.tourId] ?? 0) + row.partySize;
  }
  return totals;
}

describe("capacity parity goldens (CW0-03)", () => {
  it("booking path counts only approved party size", () => {
    assertGoldenParity({
      id: "CW0-03-booking-approved-sum",
      fixturePath: fixturePath("capacity/booking-approved-sum.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly tenantId: string;
          readonly tourIds: readonly string[];
          readonly rows: readonly {
            readonly status: string;
            readonly partySize: number;
            readonly tourId: string;
            readonly tenantId?: string;
          }[];
        }} */ (input);
        const rows = typed.rows.map((row) => ({
          tenantId: typed.tenantId,
          status: row.status,
          partySize: row.partySize,
          tourId: row.tourId,
        }));
        return {
          totalsByTourId: sumApprovedPartySizeByTourIds(
            typed.tenantId,
            typed.tourIds,
            rows
          ),
        };
      },
    });
  });

  it("urban path counts only confirmed rows via sumAcceptedRegistrationSeats", () => {
    assertGoldenParity({
      id: "CW0-03-urban-confirmed-sum",
      fixturePath: fixturePath("capacity/urban-confirmed-sum.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly rows: readonly { readonly status: string; readonly partySize: number }[];
        }} */ (input);
        return {
          acceptedSeats: sumAcceptedRegistrationSeats(typed.rows),
        };
      },
    });
  });
});
