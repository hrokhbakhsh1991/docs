import { SetMetadata } from "@nestjs/common";

export type IdempotencyHashMode = "default" | "tour-clone-source";

export type IdempotencyPolicy = {
  endpoint: string;
  statusCode: number;
  required: boolean;
  tenantSource: "body" | "context";
  tenantBodyField?: string;
  /**
   * `tour-clone-source`: hash and endpoint are derived from `sourceTourId` route param
   * and active workspace (tenant), so replays return the same cloned tour id.
   */
  hashMode?: IdempotencyHashMode;
};

export const IDEMPOTENCY_POLICY_KEY = "idempotency_policy";

export const Idempotent = (policy: IdempotencyPolicy) =>
  SetMetadata(IDEMPOTENCY_POLICY_KEY, policy);
