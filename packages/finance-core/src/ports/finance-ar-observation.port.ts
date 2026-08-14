/**
 * Optional AR observation after money-affecting finance mutations (PR23-E2 / D3-B hook).
 * Default production implementation is a no-op until D3-B persistence lands.
 */
export type ObserveRegistrationArStateInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly balanceDueMinor: string;
  readonly nowIso: string;
};

export type FinanceArObservationPort = {
  observeRegistrationArState(input: ObserveRegistrationArStateInput): Promise<void>;
};

export const nullFinanceArObservationPort: FinanceArObservationPort = {
  async observeRegistrationArState(): Promise<void> {
    /* D3-B not wired */
  },
};
