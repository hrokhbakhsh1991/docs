import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";
import { CommercialQuoteService } from "@app-tour/finance-core/application";
import type {
  CommercialQuoteRepositoryPort,
  FinanceClockPort,
} from "@app-tour/finance-core/ports";

import { getBookingsRepository } from "../bookings/create-bookings-repository";
import { createTourStorageRepository } from "../storage/create-tour-storage";
import { IdentityMembershipDiscountReadAdapter } from "./infrastructure/identity-membership-discount-read.adapter";
import { RegistrationCommercialQuoteFreezeContextAdapter } from "./infrastructure/registration-commercial-quote-freeze-context.adapter";

/** Compose CommercialQuoteService with member-discount freeze ports (CQ-2B). */
export function createCommercialQuoteServiceWithMemberDiscount(
  quotes: CommercialQuoteRepositoryPort,
  obligation: FinanceObligationPort,
  clock: FinanceClockPort
): CommercialQuoteService {
  return new CommercialQuoteService(
    quotes,
    obligation,
    clock,
    new RegistrationCommercialQuoteFreezeContextAdapter(
      getBookingsRepository(),
      createTourStorageRepository()
    ),
    new IdentityMembershipDiscountReadAdapter()
  );
}
