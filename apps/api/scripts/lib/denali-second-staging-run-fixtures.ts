import { createHash } from "node:crypto";
import { SECOND_STAGING_TENANT } from "./denali-second-staging-fixtures";

export type SecondStagingRunFixtureIds = Readonly<{
  tenantId: string;
  runId: string;
  identities: Readonly<{ owner: string; finance: string; member: string }>;
  resources: Readonly<{
    equipment: string;
    theme: string;
    region: string;
    destination: string;
    preset: string;
  }>;
  tours: Readonly<{ free: string; paid: string }>;
  registrations: Readonly<{ free: string; paid: string }>;
}>;

const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

function fixtureUuid(tenantId: string, runId: string, kind: string): string {
  const namespace = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
  const name = Buffer.from(`denali-second-staging\0${tenantId}\0${runId}\0${kind}`);
  const chars = createHash("sha1")
    .update(namespace)
    .update(name)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16]!, 16) & 0x3) | 0x8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Run-scoped IDs for synthetic B-only catalog, tour and registration fixtures. */
export function buildSecondStagingRunFixtureIds(input: {
  tenantId: string;
  runId: string;
  identityUserIds: Readonly<{ owner: string; finance: string; member: string }>;
}): SecondStagingRunFixtureIds {
  if (input.tenantId !== SECOND_STAGING_TENANT.id) {
    throw new Error("DENALI_SECOND_STAGING_FIXTURE_TENANT_REJECTED");
  }
  if (!RUN_ID_PATTERN.test(input.runId)) {
    throw new Error("DENALI_SECOND_STAGING_FIXTURE_RUN_ID_INVALID");
  }
  const identityIds = Object.values(input.identityUserIds);
  if (
    identityIds.length !== 3 ||
    new Set(identityIds).size !== 3 ||
    identityIds.some((value) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
  ) {
    throw new Error("DENALI_SECOND_STAGING_FIXTURE_IDENTITIES_INVALID");
  }

  const id = (kind: string) => fixtureUuid(input.tenantId, input.runId, kind);
  return {
    tenantId: input.tenantId,
    runId: input.runId,
    identities: input.identityUserIds,
    resources: {
      equipment: id("resource-equipment"),
      theme: id("resource-theme"),
      region: id("resource-region"),
      destination: id("resource-destination"),
      preset: id("resource-preset"),
    },
    tours: { free: id("tour-free"), paid: id("tour-paid") },
    registrations: { free: id("registration-free"), paid: id("registration-paid") },
  };
}
