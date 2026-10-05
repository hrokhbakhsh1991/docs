import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RegistrationCommercialQuoteFreezeContextAdapter } from "../src/workspace-finance/infrastructure/registration-commercial-quote-freeze-context.adapter";

const tenantId = "tenant-qa";
const tourId = "tour-qa";

function adapterFor(registrationIntake: Record<string, unknown>) {
  return new RegistrationCommercialQuoteFreezeContextAdapter(
    {
      getById: async () =>
        ({
          id: "registration-qa",
          tenantId,
          tourId,
          submittedByUserId: "member-qa",
          registrationIntake,
        }) as never,
    },
    {
      getById: async () => ({ canonical: { pricing: { allowMembershipDiscount: true } } }) as never,
    },
    () => true
  );
}

describe("RegistrationCommercialQuoteFreezeContextAdapter", () => {
  it("BUG-STG-022 does not price an other participant with the submitter membership", async () => {
    const context = await adapterFor({
      registrantTarget: "other",
    }).resolveRegistrationFreezeContext({
      tenantId,
      registrationId: "registration-qa",
    });

    assert.deepEqual(context, {
      memberUserId: null,
      allowMembershipDiscount: true,
    });
  });

  it("keeps the submitter membership for a self participant", async () => {
    const context = await adapterFor({ registrantTarget: "self" }).resolveRegistrationFreezeContext({
      tenantId,
      registrationId: "registration-qa",
    });

    assert.deepEqual(context, {
      memberUserId: "member-qa",
      allowMembershipDiscount: true,
    });
  });
});
