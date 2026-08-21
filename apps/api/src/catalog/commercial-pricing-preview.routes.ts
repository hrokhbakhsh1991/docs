import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildCommercialQuoteFreezeInput,
  readTourAllowMembershipDiscount,
  resolveLiveObligationDiscountableBaseMinor,
} from "@app-tour/finance-core/domain";

import { sendJson } from "../http/json";
import { requireOperatorSession } from "../identity/require-operator-session";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { createTourStorageRepository } from "../storage/create-tour-storage";
import { IdentityMembershipDiscountReadAdapter } from "../workspace-finance/infrastructure/identity-membership-discount-read.adapter";
import {
  isFinanceObligationBindingRegistered,
  WORKSPACE_FINANCE_OBLIGATION_BINDINGS,
} from "../workspace-finance/workspace-finance-obligation-bindings.generated";

function readQueryString(req: IncomingMessage, key: string): string {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return url.searchParams.get(key)?.trim() ?? "";
}

function readPartySize(req: IncomingMessage): number {
  const parsed = Number.parseInt(readQueryString(req, "partySize"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readRegistrationIntake(req: IncomingMessage): {
  readonly transport?: { readonly kind: string };
} {
  const transportKind = readQueryString(req, "transportKind");
  return transportKind.length > 0 ? { transport: { kind: transportKind } } : {};
}

export async function handleCatalogCommercialPricingPreview(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const workspace = readQueryString(req, "workspace") || "denali";
    const normalizedWorkspace = workspace.toLowerCase();
    const tourId = readQueryString(req, "tourId");
    if (tourId.length === 0) {
      sendHttpError(res, 400, { error: "bad_request", code: "TOUR_ID_REQUIRED" });
      return;
    }
    if (!isFinanceObligationBindingRegistered(normalizedWorkspace)) {
      sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PRICING_UNAVAILABLE" });
      return;
    }

    const tour = await createTourStorageRepository().getById(tourId, auth.tenantId);
    if (tour === null) {
      sendHttpError(res, 404, { error: "not_found", code: "TOUR_NOT_FOUND" });
      return;
    }

    const binding =
      WORKSPACE_FINANCE_OBLIGATION_BINDINGS[
        normalizedWorkspace as keyof typeof WORKSPACE_FINANCE_OBLIGATION_BINDINGS
      ];
    const resolveObligation = await binding.loadResolve();
    const resolvePaymentCollection: (tourCanonical: unknown) => "offline" | "free" =
      "loadPaymentCollection" in binding ? await binding.loadPaymentCollection() : () => "offline";
    const obligation = resolveObligation({
      tourCanonical: tour.canonical,
      partySize: readPartySize(req),
      registrationIntake: readRegistrationIntake(req),
    });
    if (obligation === null) {
      sendHttpError(res, 404, { error: "not_found", code: "PRICING_UNAVAILABLE" });
      return;
    }

    const allowMembershipDiscount = readTourAllowMembershipDiscount(tour.canonical);
    const membershipDiscountPercentage = allowMembershipDiscount
      ? await new IdentityMembershipDiscountReadAdapter().getMembershipDiscountPercentage(
          auth.tenantId,
          auth.userId
        )
      : null;
    const quoteInput = buildCommercialQuoteFreezeInput({
      tenantId: auth.tenantId,
      registrationId: `preview:${tourId}:${auth.userId}`,
      obligation,
      paymentCollection: resolvePaymentCollection(tour.canonical),
      memberUserId: auth.userId,
      allowMembershipDiscount,
      membershipDiscountPercentage,
    });
    const lines = "lines" in obligation && Array.isArray(obligation.lines) ? obligation.lines : [];

    sendJson(res, 200, {
      ok: true,
      preview: {
        grossMinor: quoteInput.grossMinor,
        discountableBaseMinor: resolveLiveObligationDiscountableBaseMinor(obligation),
        memberDiscountPercentage: quoteInput.memberDiscount?.percentageApplied ?? 0,
        memberDiscountMinor: quoteInput.memberDiscount?.discountMinor ?? "0",
        payableMinor: quoteInput.payableMinor,
        currency: quoteInput.currency,
        source: quoteInput.source,
        lines,
      },
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}
