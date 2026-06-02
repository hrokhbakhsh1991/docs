import { Inject, Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";

import { PricingEngineService } from "../../pricing/pricing-engine.service";
import type {
  PricingEngineInput,
  PricingEngineQuoteOptions,
  PricingQuoteResult,
} from "../domain/pricing-catalog.types";
import type { PricingCatalogPort } from "../domain/ports/pricing-catalog.port";
import { getIdempotentEntityManager } from "../../idempotency/idempotent-transaction.context";

@Injectable()
export class PricingCatalogAdapter implements PricingCatalogPort {
  constructor(
    @Inject(PricingEngineService) private readonly pricingEngine: PricingEngineService,
    @Inject(EntityManager) private readonly manager: EntityManager
  ) {}

  quote(
    input: PricingEngineInput,
    options?: PricingEngineQuoteOptions
  ): Promise<PricingQuoteResult> {
    const activeManager = getIdempotentEntityManager() ?? this.manager;
    return this.pricingEngine.quote(activeManager, input, options);
  }
}

