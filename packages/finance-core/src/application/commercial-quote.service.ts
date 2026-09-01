/**
 * Commercial Quote application service — version lifecycle + money-path freeze (CQ-1A / CQ-1B / CQ-2B).
 */

import {
  assertCommercialQuoteChainNotLocked,
  assertCommercialQuoteMinor,
  buildCommercialQuoteFreezeInput,
  commercialQuoteMatchesFreezeInput,
  COMMERCIAL_QUOTE_CALCULATION_VERSION,
  mapFreezeInputToCommercialPricingDisplay,
  mapQuoteVersionToCommercialPricingDisplay,
  normalizeCommercialQuoteCurrency,
  type CommercialQuoteFreezeInput,
  type CommercialQuoteVersion,
  type CreateCommercialQuoteVersionInput,
  type RegistrationCommercialPricingDisplay,
} from "../domain/commercial-quote";
import type { FinanceObligationPort } from "../ports/finance-receipt-defaults.port";
import type { FinanceClockPort } from "../ports/finance-clock.port";
import type { CommercialQuoteRepositoryPort } from "../ports/commercial-quote-repository.port";
import type { CommercialQuoteFreezeContextPort } from "../ports/commercial-quote-freeze-context.port";
import type { MembershipDiscountReadPort } from "../ports/membership-discount-read.port";

function normalizeCreateInput(
  input: CreateCommercialQuoteVersionInput
): CreateCommercialQuoteVersionInput {
  return {
    tenantId: input.tenantId.trim(),
    registrationId: input.registrationId.trim(),
    grossMinor: assertCommercialQuoteMinor(input.grossMinor, "grossMinor"),
    payableMinor: assertCommercialQuoteMinor(input.payableMinor, "payableMinor"),
    currency: normalizeCommercialQuoteCurrency(input.currency),
    source: input.source,
    calculationVersion: input.calculationVersion ?? COMMERCIAL_QUOTE_CALCULATION_VERSION,
    supersedesVersionId: input.supersedesVersionId ?? null,
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
    ...(input.tourId !== undefined ? { tourId: input.tourId.trim() } : {}),
    ...(input.memberDiscount !== undefined ? { memberDiscount: input.memberDiscount } : {}),
  };
}

export class CommercialQuoteService {
  constructor(
    private readonly quotes: CommercialQuoteRepositoryPort,
    private readonly obligation: FinanceObligationPort,
    private readonly clock: FinanceClockPort,
    private readonly freezeContext: CommercialQuoteFreezeContextPort | null = null,
    private readonly membershipDiscount: MembershipDiscountReadPort | null = null
  ) {}

  async getActiveQuote(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteVersion | null> {
    return this.quotes.getActive(tenantId.trim(), registrationId.trim());
  }

  async getQuoteChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return this.quotes.getChain(tenantId.trim(), registrationId.trim());
  }

  private async buildCurrentQuoteInput(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteFreezeInput | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedRegistrationId = registrationId.trim();
    const resolved = await this.obligation.resolveRegistrationObligation({
      tenantId: normalizedTenantId,
      registrationId: normalizedRegistrationId,
    });
    if (resolved === null) {
      return null;
    }

    const paymentCollection = await this.obligation.resolveRegistrationPaymentCollection({
      tenantId: normalizedTenantId,
      registrationId: normalizedRegistrationId,
    });

    const freezeContext =
      this.freezeContext === null
        ? { memberUserId: null, allowMembershipDiscount: false }
        : ((await this.freezeContext.resolveRegistrationFreezeContext({
            tenantId: normalizedTenantId,
            registrationId: normalizedRegistrationId,
          })) ?? { memberUserId: null, allowMembershipDiscount: false });

    let membershipDiscountPercentage: number | null = null;
    if (
      this.membershipDiscount !== null &&
      freezeContext.memberUserId !== null &&
      freezeContext.allowMembershipDiscount
    ) {
      membershipDiscountPercentage = await this.membershipDiscount.getMembershipDiscountPercentage(
        normalizedTenantId,
        freezeContext.memberUserId
      );
    }

    return normalizeCreateInput(
      buildCommercialQuoteFreezeInput({
        tenantId: normalizedTenantId,
        registrationId: normalizedRegistrationId,
        obligation: resolved,
        paymentCollection,
        memberUserId: freezeContext.memberUserId,
        allowMembershipDiscount: freezeContext.allowMembershipDiscount,
        membershipDiscountPercentage,
        createdAt: this.clock.nowIso(),
      })
    );
  }

  /**
   * Passive read preview. Shares the freeze reducer but never creates or supersedes quote rows.
   */
  async resolveCommercialQuotePreview(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteFreezeInput | null> {
    return this.buildCurrentQuoteInput(tenantId, registrationId);
  }

  /**
   * Authoritative commercial pricing for cross-surface display (portal, operator, invoice).
   * Prefers live reducer when frozen quote is stale on same gross but different membership terms.
   */
  async resolveRegistrationCommercialPricing(
    tenantId: string,
    registrationId: string
  ): Promise<RegistrationCommercialPricingDisplay | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedRegistrationId = registrationId.trim();
    const quoteInput = await this.buildCurrentQuoteInput(normalizedTenantId, normalizedRegistrationId);
    if (quoteInput === null) {
      return null;
    }

    const displayOptions = await this.resolveMembershipDisplayOptions(
      normalizedTenantId,
      normalizedRegistrationId,
      quoteInput
    );
    const active = await this.quotes.getActive(normalizedTenantId, normalizedRegistrationId);
    if (active !== null) {
      if (commercialQuoteMatchesFreezeInput(active, quoteInput)) {
        return mapQuoteVersionToCommercialPricingDisplay(active, displayOptions);
      }
      if (active.status === "FROZEN") {
        const frozenPayableMinor = BigInt(active.payableMinor.replace(/\D/g, "") || "0");
        const previewPayableMinor = BigInt(quoteInput.payableMinor.replace(/\D/g, "") || "0");
        if (previewPayableMinor < frozenPayableMinor) {
          return mapFreezeInputToCommercialPricingDisplay(quoteInput, {
            quoteStatus: active.status,
            ...displayOptions,
          });
        }
        return mapQuoteVersionToCommercialPricingDisplay(active, displayOptions);
      }
      return mapFreezeInputToCommercialPricingDisplay(quoteInput, {
        quoteStatus: active.status,
        ...displayOptions,
      });
    }

    return mapFreezeInputToCommercialPricingDisplay(quoteInput, {
      quoteStatus: null,
      ...displayOptions,
    });
  }

  private async resolveMembershipDisplayOptions(
    tenantId: string,
    registrationId: string,
    quoteInput: CommercialQuoteFreezeInput
  ): Promise<{
    readonly membershipDiscountBlocked?: boolean;
    readonly memberPermanentDiscountPercentage?: number | null;
  }> {
    if (this.freezeContext === null || this.membershipDiscount === null) {
      return {};
    }
    const freezeContext = await this.freezeContext.resolveRegistrationFreezeContext({
      tenantId,
      registrationId,
    });
    if (freezeContext === null || freezeContext.memberUserId === null) {
      return {};
    }
    const memberPermanentDiscountPercentage =
      await this.membershipDiscount.getMembershipDiscountPercentage(
        tenantId,
        freezeContext.memberUserId
      );
    const membershipDiscountBlocked =
      (memberPermanentDiscountPercentage ?? 0) > 0 &&
      !freezeContext.allowMembershipDiscount &&
      quoteInput.source === "tour_canonical";
    return {
      memberPermanentDiscountPercentage,
      ...(membershipDiscountBlocked ? { membershipDiscountBlocked: true } : {}),
    };
  }

  /**
   * DEC-CQ-008 — freeze on money path when registration is quotable.
   * Returns null when obligation cannot resolve (legacy path continues).
   */
  /**
   * DEC-CQ-001 amend (DP1-D) — freeze commercial quote synchronously on booking approve.
   * Idempotent when an active FROZEN quote already matches the current obligation snapshot.
   */
  async ensureFrozenOnApprove(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteVersion | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedRegistrationId = registrationId.trim();

    const active = await this.quotes.getActive(normalizedTenantId, normalizedRegistrationId);
    if (active?.status === "LOCKED") {
      return active;
    }

    const chain = await this.quotes.getChain(normalizedTenantId, normalizedRegistrationId);
    assertCommercialQuoteChainNotLocked(chain);

    const quoteInput = await this.buildCurrentQuoteInput(
      normalizedTenantId,
      normalizedRegistrationId
    );
    if (quoteInput === null) {
      return null;
    }

    if (active !== null && commercialQuoteMatchesFreezeInput(active, quoteInput)) {
      return active;
    }
    if (active !== null) {
      return this.supersedeQuote(quoteInput);
    }
    if (chain.length === 0) {
      return this.createQuoteVersion(quoteInput);
    }
    return this.supersedeQuote(quoteInput);
  }

  async ensureFrozenForMoneyPath(
    tenantId: string,
    registrationId: string
  ): Promise<CommercialQuoteVersion | null> {
    const normalizedTenantId = tenantId.trim();
    const normalizedRegistrationId = registrationId.trim();

    const active = await this.quotes.getActive(normalizedTenantId, normalizedRegistrationId);
    if (active?.status === "LOCKED") {
      return active;
    }

    const chain = await this.quotes.getChain(normalizedTenantId, normalizedRegistrationId);
    assertCommercialQuoteChainNotLocked(chain);

    const quoteInput = await this.buildCurrentQuoteInput(
      normalizedTenantId,
      normalizedRegistrationId
    );
    if (quoteInput === null) {
      return null;
    }

    if (active !== null && commercialQuoteMatchesFreezeInput(active, quoteInput)) {
      return active;
    }
    if (active !== null) {
      return this.supersedeQuote(quoteInput);
    }
    if (chain.length === 0) {
      return this.createQuoteVersion(quoteInput);
    }
    return this.supersedeQuote(quoteInput);
  }

  /** First version on an empty, unlocked chain. */
  async createQuoteVersion(
    input: CreateCommercialQuoteVersionInput
  ): Promise<CommercialQuoteVersion> {
    const normalized = normalizeCreateInput(input);
    const chain = await this.quotes.getChain(normalized.tenantId, normalized.registrationId);
    assertCommercialQuoteChainNotLocked(chain);
    if (chain.length > 0) {
      throw new Error("COMMERCIAL_QUOTE_ALREADY_EXISTS");
    }
    return this.quotes.createVersion(normalized);
  }

  /** New immutable version; prior active → SUPERSEDED. Never mutates commercial fields on prior row. */
  async supersedeQuote(input: CreateCommercialQuoteVersionInput): Promise<CommercialQuoteVersion> {
    const normalized = normalizeCreateInput(input);
    const chain = await this.quotes.getChain(normalized.tenantId, normalized.registrationId);
    assertCommercialQuoteChainNotLocked(chain);

    const active = await this.quotes.getActive(normalized.tenantId, normalized.registrationId);
    if (active !== null) {
      await this.quotes.markSuperseded(normalized.tenantId, active.id);
    }

    return this.quotes.createVersion({
      ...normalized,
      supersedesVersionId: active?.id ?? null,
    });
  }

  async lockQuoteChain(
    tenantId: string,
    registrationId: string
  ): Promise<readonly CommercialQuoteVersion[]> {
    return this.quotes.lockChain(tenantId.trim(), registrationId.trim());
  }
}
