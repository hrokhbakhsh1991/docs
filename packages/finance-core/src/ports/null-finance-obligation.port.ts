import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

/** No-op obligation resolver for workspaces without commercial pricing bind (FC-2). */
export const nullFinanceObligationPort: FinanceObligationPort = {
  async resolveRegistrationObligation() {
    return null;
  },
};
