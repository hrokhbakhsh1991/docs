import { describe, it } from "node:test";

import { resolveDenaliRegistrationObligationMinor } from "../../packages/workspaces/denali/src/finance/resolve-denali-registration-obligation.ts";
import { readTourAllowMembershipDiscount } from "../../packages/finance-core/src/domain/commercial-quote/read-tour-membership-discount-gate.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

describe("pricing finance parity goldens (CW0-08)", () => {
  it("resolveDenaliRegistrationObligationMinor outputs match finance-obligation spec", () => {
    assertGoldenParity({
      id: "CW0-08-denali-obligation-cases",
      fixturePath: fixturePath("pricing-finance/denali-obligation-cases.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly cases: readonly {
            readonly label: string;
            readonly tourCanonical: unknown;
            readonly partySize: number;
            readonly currency?: string;
          }[];
        }} */ (input);
        return {
          results: typed.cases.map((row) => ({
            label: row.label,
            resolved: resolveDenaliRegistrationObligationMinor({
              tourCanonical: row.tourCanonical,
              partySize: row.partySize,
              currency: row.currency,
            }),
          })),
        };
      },
    });
  });

  it("readTourAllowMembershipDiscount fail-closed gate matches CQ-2D spec", () => {
    assertGoldenParity({
      id: "CW0-08-membership-discount-gate",
      fixturePath: fixturePath("pricing-finance/membership-discount-gate.json"),
      run: (input) => {
        const typed = /** @type {{
          readonly cases: readonly {
            readonly label: string;
            readonly tourCanonical: unknown;
          }[];
        }} */ (input);
        return {
          results: typed.cases.map((row) => ({
            label: row.label,
            allowed: readTourAllowMembershipDiscount(row.tourCanonical),
          })),
        };
      },
    });
  });
});
