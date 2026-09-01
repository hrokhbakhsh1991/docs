import type { RegistrationCommercialPricingDisplay } from "@app-tour/finance-http-contracts";

/** Host resolves Finance commercial quote display for a registration. */
export interface RegistrationCommercialPricingPort {
  resolveRegistrationCommercialPricing(input: {
    readonly tenantId: string;
    readonly registrationId: string;
  }): Promise<RegistrationCommercialPricingDisplay | null>;
}

export type { RegistrationCommercialPricingDisplay };
