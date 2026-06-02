import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { tryParseWorkspaceUserRole, UserRole } from "../../../common/auth/user-role.enum";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { bookableTourDepartureId } from "../domain/bookable-departure-id";
import {
  mapPricingQuoteToRegistrationQuoteSnapshot,
  type RegistrationQuoteSnapshot,
} from "../domain/map-pricing-quote-to-registration-quote";
import {
  PRICING_CATALOG_PORT,
  type PricingCatalogPort,
} from "../domain/ports/pricing-catalog.port";
import type { RegistrationQuoteTourContext } from "../domain/registration-quote-tour.types";

/**
 * Application slice: **registration pricing quote** — delegates to {@link PricingCatalogPort}, which wraps
 * the finance {@link calculateQuote} pipeline (authoritative pricing engine).
 */
@Injectable()
export class RegistrationQuoteApplicationService {
  constructor(
    @Inject(PRICING_CATALOG_PORT) private readonly pricingCatalog: PricingCatalogPort,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  private resolveQuoteRole(): UserRole {
    return tryParseWorkspaceUserRole(this.requestContextService.getRole()) ?? UserRole.Member;
  }

  async buildQuoteSnapshot(
    _manager: EntityManager,
    tour: RegistrationQuoteTourContext,
    discountCode?: string | null
  ): Promise<RegistrationQuoteSnapshot> {
    const departureId = bookableTourDepartureId(tour);
    const quote = await this.pricingCatalog.quote({
      tenantId: tour.tenantId,
      tourId: tour.id,
      departureId,
      userRole: this.resolveQuoteRole(),
      discountCode: discountCode ?? null
    });
    return mapPricingQuoteToRegistrationQuoteSnapshot(quote);
  }
}
