import { resolve } from "node:dns/promises";

export async function lookupTenantDomainCname(hostname: string): Promise<string | null> {
  if (process.env.PLATFORM_DOMAIN_DNS_LOOKUP === "off") return null;
  try {
    const records = await resolve(hostname, "CNAME");
    const first = records[0]?.trim().toLowerCase();
    return first && first.length > 0 ? first.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}
