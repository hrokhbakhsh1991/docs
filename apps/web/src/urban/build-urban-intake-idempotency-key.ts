import { createHash } from "node:crypto";

export function buildUrbanIntakeIdempotencyKey(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly email: string;
  readonly actorUserId: string;
}): string {
  const digest = createHash("sha256")
    .update(
      `${input.tenantId}:${input.tourId}:${input.email.trim().toLowerCase()}:${input.actorUserId}`
    )
    .digest("hex");
  return `catalog-urban-intake-${digest.slice(0, 32)}`;
}
