import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { tryParseWorkspaceUserRole, UserRole } from "../../../common/auth/user-role.enum";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import type { TourEntity } from "../../tours/entities/tour.entity";
import { PricingEngineService } from "../../pricing/pricing-engine.service";
import { bookableTourDepartureId } from "../domain/bookable-departure-id";
import {
  mapPricingQuoteToRegistrationQuoteSnapshot,
  type RegistrationQuoteSnapshot
} from "../domain/map-pricing-quote-to-registration-quote";

/**
 * Application slice: **registration pricing quote** — delegates to {@link PricingEngineService}, which is
 * authoritative (finance {@link calculateQuote} / bounded-context rules engine).
 */
@Injectable()
export class RegistrationQuoteApplicationService {
  constructor(
    @Inject(PricingEngineService) private readonly pricingEngine: PricingEngineService,
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService
  ) {}

  private resolveQuoteRole(): UserRole {
    return tryParseWorkspaceUserRole(this.requestContextService.getRole()) ?? UserRole.Member;
  }

  async buildQuoteSnapshot(
    manager: EntityManager,
    tour: TourEntity,
    discountCode?: string | null
  ): Promise<RegistrationQuoteSnapshot> {
    const departureId = bookableTourDepartureId(tour);
    const quote = await this.pricingEngine.quote(manager, {
      tenantId: tour.tenantId,
      tourId: tour.id,
      departureId,
      userRole: this.resolveQuoteRole(),
      discountCode: discountCode ?? null
    });
    return mapPricingQuoteToRegistrationQuoteSnapshot(quote);
  }
}
