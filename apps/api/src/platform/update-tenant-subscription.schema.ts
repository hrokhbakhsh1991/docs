import { PlatformValidation } from "./platform.errors.ts";

const PLAN_IDS = new Set(["standard", "enterprise"]);
const STATUS_VALUES = new Set(["active", "past_due", "canceled"]);

export type UpdateTenantSubscriptionBody = {
  readonly planId?: "standard" | "enterprise";
  readonly status?: "active" | "past_due" | "canceled";
};

export function parseUpdateTenantSubscriptionBody(body: unknown): UpdateTenantSubscriptionBody {
  if (typeof body !== "object" || body === null) {
    throw new PlatformValidation("INVALID_BODY");
  }
  const record = body as Record<string, unknown>;
  let planId: UpdateTenantSubscriptionBody["planId"] | undefined;
  let status: UpdateTenantSubscriptionBody["status"] | undefined;

  if (record.planId !== undefined) {
    if (typeof record.planId !== "string" || !PLAN_IDS.has(record.planId)) {
      throw new PlatformValidation("INVALID_PLAN_ID");
    }
    planId = record.planId as UpdateTenantSubscriptionBody["planId"];
  }

  if (record.status !== undefined) {
    if (typeof record.status !== "string" || !STATUS_VALUES.has(record.status)) {
      throw new PlatformValidation("INVALID_STATUS");
    }
    status = record.status as UpdateTenantSubscriptionBody["status"];
  }

  if (planId === undefined && status === undefined) {
    throw new PlatformValidation("EMPTY_PATCH");
  }

  return {
    ...(planId === undefined ? {} : { planId }),
    ...(status === undefined ? {} : { status }),
  };
}
