/**
 * DP1-D — Commercial quote freeze port for approve integration.
 */
import { CommercialQuoteService } from "@app-tour/finance-core/application";

import { HostCommercialQuoteRepository } from "../workspace-finance/infrastructure/host-commercial-quote.repository.ts";
import { createCommercialQuoteServiceWithMemberDiscount } from "../workspace-finance/create-commercial-quote-service.ts";
import { createFinanceObligationPort } from "../workspace-finance/finance-obligation.factory.ts";
import { HostFinanceClockAdapter } from "../workspace-finance/infrastructure/host-finance-clock.adapter.ts";
import { resolveFinanceWorkspaceTypeForTenant } from "../workspace-finance/resolve-finance-workspace-type-for-tenant.ts";

let cachedByTenant = new Map<string, CommercialQuoteService>();

export function resetCommercialQuoteApproveCacheForTests(): void {
  cachedByTenant = new Map();
}

async function resolveCommercialQuoteService(tenantId: string): Promise<CommercialQuoteService> {
  const cached = cachedByTenant.get(tenantId);
  if (cached !== undefined) {
    return cached;
  }
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  const obligation = await createFinanceObligationPort(workspaceType);
  const repo = new HostCommercialQuoteRepository();
  const service = createCommercialQuoteServiceWithMemberDiscount(
    repo,
    obligation,
    new HostFinanceClockAdapter()
  );
  cachedByTenant.set(tenantId, service);
  return service;
}

export function createCommercialQuoteApproveServiceForTests(): {
  ensureFrozenOnApprove(
    tenantId: string,
    registrationId: string
  ): Promise<{ readonly payableMinor: string; readonly status: string; readonly source?: string } | null>;
  getActiveQuote(
    tenantId: string,
    registrationId: string
  ): Promise<{ readonly payableMinor: string; readonly status: string } | null>;
} {
  return {
    async ensureFrozenOnApprove(tenantId, registrationId) {
      const quotes = await resolveCommercialQuoteService(tenantId);
      const frozen = await quotes.ensureFrozenOnApprove(tenantId, registrationId);
      if (frozen === null) {
        return null;
      }
      return {
        payableMinor: frozen.payableMinor,
        status: frozen.status,
        source: frozen.source,
      };
    },
    async getActiveQuote(tenantId, registrationId) {
      const quotes = await resolveCommercialQuoteService(tenantId);
      const active = await quotes.getActiveQuote(tenantId, registrationId);
      if (active === null) {
        return null;
      }
      return { payableMinor: active.payableMinor, status: active.status };
    },
  };
}

export async function ensureFrozenCommercialQuoteOnApprove(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<{ readonly payableMinor: string; readonly status: string; readonly source?: string } | null> {
  return createCommercialQuoteApproveServiceForTests().ensureFrozenOnApprove(
    input.tenantId,
    input.registrationId
  );
}
