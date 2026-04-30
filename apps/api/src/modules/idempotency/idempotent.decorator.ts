import { SetMetadata } from "@nestjs/common";

export type IdempotencyPolicy = {
  endpoint: string;
  statusCode: number;
  required: boolean;
  tenantSource: "body" | "context";
  tenantBodyField?: string;
};

export const IDEMPOTENCY_POLICY_KEY = "idempotency_policy";

export const Idempotent = (policy: IdempotencyPolicy) =>
  SetMetadata(IDEMPOTENCY_POLICY_KEY, policy);
