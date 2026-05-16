import type { EntityManager } from "typeorm";
import type { PricingEngineService } from "../../src/modules/pricing/pricing-engine.service";
import type { PricingEngineInput, PricingEngineQuoteOptions } from "../../src/modules/pricing/pricing.types";
import type { RegistrationQuoteApplicationService } from "../../src/modules/registrations/application/registration-quote.application.service";

/** Minimal {@link PricingEngineService} for unit tests that do not exercise pricing rules. */
export const stubPricingEngine = {
  async quote(_manager: EntityManager, _input: PricingEngineInput, _options?: PricingEngineQuoteOptions) {
    return {
      line_items: [
        {
          line_id: "base",
          kind: "base" as const,
          description: "stub",
          amount_minor: "10000",
          currency_code: "USD"
        }
      ],
      total: "10000",
      pricing_version: "stub:v0",
      pricing_rule_version: "stub:v0",
      currency_code: "USD"
    };
  }
} as unknown as PricingEngineService;

/** Minimal {@link RegistrationQuoteApplicationService} for tests that skip real pricing. */
export const stubRegistrationQuoteApplication = {
  async buildQuoteSnapshot() {
    return {
      quotedListPriceMinor: "10000",
      quotedCurrencyCode: "USD",
      quotedTotalMinor: "10000",
      quotedPricingVersion: "stub:v0",
      quotedLineItemsJson: [
        {
          line_id: "base",
          kind: "base" as const,
          description: "stub",
          amount_minor: "10000",
          currency_code: "USD"
        }
      ]
    };
  }
} as unknown as RegistrationQuoteApplicationService;
