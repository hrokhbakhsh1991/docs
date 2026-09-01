import type { RegistrationCommercialPricingDisplay } from "@app-tour/finance-http-contracts";

import { createCommercialQuoteServiceWithMemberDiscount } from "../create-commercial-quote-service.ts";
import { createFinanceObligationPort } from "../finance-obligation.factory.ts";
import { resolveFinanceWorkspaceTypeForTenant } from "../resolve-finance-workspace-type-for-tenant.ts";
import { HostCommercialQuoteRepository } from "./host-commercial-quote.repository.ts";
import { HostFinanceClockAdapter } from "./host-finance-clock.adapter.ts";

let cachedByTenant = new Map<
  string,
  ReturnType<typeof createCommercialQuoteServiceWithMemberDiscount>
>();

export function resetRegistrationCommercialPricingReadCacheForTests(): void {
  cachedByTenant = new Map();
}

async function resolveQuoteService(tenantId: string) {
  const cached = cachedByTenant.get(tenantId);
  if (cached !== undefined) {
    return cached;
  }
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  const obligation = await createFinanceObligationPort(workspaceType);
  const service = createCommercialQuoteServiceWithMemberDiscount(
    new HostCommercialQuoteRepository(),
    obligation,
    new HostFinanceClockAdapter()
  );
  cachedByTenant.set(tenantId, service);
  return service;
}

export class RegistrationCommercialPricingReadAdapter {
  async resolveRegistrationCommercialPricing(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<RegistrationCommercialPricingDisplay | null> {
    const quotes = await resolveQuoteService(input.tenantId);
    return quotes.resolveRegistrationCommercialPricing(input.tenantId, input.registrationId);
  }
}
