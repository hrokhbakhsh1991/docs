import { lookupTenantDomainCname } from "./lookup-tenant-domain-cname.ts";

export type VerifyTenantDomainInput = {
  readonly hostname: string;
  readonly cnameTarget: string;
  readonly observedCname?: string;
};

export type VerifyTenantDomainResult = {
  readonly ok: boolean;
  readonly message: string;
  readonly observedCname?: string | null;
};

/**
 * Pure CNAME comparison helper — used by live verify and tests.
 * When `observedCname` is omitted, honors `PLATFORM_DOMAIN_VERIFY_STUB=pass` for dev.
 */
export function verifyTenantDomainCname(input: VerifyTenantDomainInput): VerifyTenantDomainResult {
  const observed = input.observedCname?.trim().toLowerCase();
  const expected = input.cnameTarget.trim().toLowerCase();
  if (observed && observed === expected) {
    return { ok: true, message: "CNAME matches target" };
  }
  if (process.env.PLATFORM_DOMAIN_VERIFY_STUB === "pass") {
    return { ok: true, message: "Verification stub pass" };
  }
  return { ok: false, message: "CNAME does not match expected target" };
}

export async function verifyTenantDomainCnameLive(input: {
  hostname: string;
  cnameTarget: string;
}): Promise<VerifyTenantDomainResult> {
  const observed = await lookupTenantDomainCname(input.hostname);
  const result = verifyTenantDomainCname({
    hostname: input.hostname,
    cnameTarget: input.cnameTarget,
    observedCname: observed ?? undefined,
  });
  return { ...result, observedCname: observed };
}
