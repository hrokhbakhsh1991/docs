import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { PricingEngineService } from "../../pricing/pricing-engine.service";
import type {
  PricingEngineInput,
  PricingEngineQuoteOptions,
  PricingQuoteResult,
} from "../domain/pricing-catalog.types";
import type { PricingCatalogPort } from "../domain/ports/pricing-catalog.port";

@Injectable()
export class PricingCatalogAdapter implements PricingCatalogPort {
  constructor(@Inject(PricingEngineService) private readonly pricingEngine: PricingEngineService) {}

  quote(
    manager: EntityManager,
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult> {
    return this.pricingEngine.quote(manager, input, options);
  }
}
