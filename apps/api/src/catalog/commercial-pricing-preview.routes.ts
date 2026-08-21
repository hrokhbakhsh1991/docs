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
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { IdentityMembershipDiscountReadAdapter } from "../workspace-finance/infrastructure/identity-membership-discount-read.adapter";
import {
  isFinanceObligationBindingRegistered,
  WORKSPACE_FINANCE_OBLIGATION_BINDINGS,
} from "../workspace-finance/workspace-finance-obligation-bindings.generated";

function readQueryString(req: IncomingMessage, key: string): string {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return url.searchParams.get(key)?.trim() ?? "";
}

function readQueryStrings(req: IncomingMessage, key: string): readonly string[] {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return url.searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
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

function normalizeWorkspaceType(value: string): string {
  return value.trim().toLowerCase();
}

export async function resolveCommercialPricingWorkspace(
  req: IncomingMessage,
  tenantId: string,
  resolveTenantWorkspace: (tenantId: string) => Promise<string> = resolveWorkspaceTypeForTenant
): Promise<string | null> {
  const tenantWorkspace = normalizeWorkspaceType(await resolveTenantWorkspace(tenantId));
  const requestedWorkspace = normalizeWorkspaceType(readQueryString(req, "workspace"));

  if (requestedWorkspace.length > 0 && requestedWorkspace !== tenantWorkspace) {
    return null;
  }
  return tenantWorkspace;
}

type CommercialPricingPreviewDto = {
  readonly grossMinor: string;
  readonly discountableBaseMinor: string;
  readonly memberDiscountPercentage: number;
  readonly memberDiscountMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly source: string;
  readonly lines: readonly unknown[];
};

async function resolveCommercialPricingPreview(input: {
  readonly tenantId: string;
  readonly memberUserId: string;
  readonly workspace: string;
  readonly tourId: string;
  readonly partySize: number;
  readonly registrationIntake: { readonly transport?: { readonly kind: string } };
}): Promise<CommercialPricingPreviewDto | null> {
  const normalizedWorkspace = input.workspace.toLowerCase();
  if (!isFinanceObligationBindingRegistered(normalizedWorkspace)) {
    return null;
  }

  const tour = await createTourStorageRepository().getById(input.tourId, input.tenantId);
  if (tour === null) {
    return null;
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
    partySize: input.partySize,
    registrationIntake: input.registrationIntake,
  });
  if (obligation === null) {
    return null;
  }

  const allowMembershipDiscount = readTourAllowMembershipDiscount(tour.canonical);
  const membershipDiscountPercentage = allowMembershipDiscount
    ? await new IdentityMembershipDiscountReadAdapter().getMembershipDiscountPercentage(
        input.tenantId,
        input.memberUserId
      )
    : null;
  const quoteInput = buildCommercialQuoteFreezeInput({
    tenantId: input.tenantId,
    registrationId: `preview:${input.tourId}:${input.memberUserId}`,
    obligation,
    paymentCollection: resolvePaymentCollection(tour.canonical),
    memberUserId: input.memberUserId,
    allowMembershipDiscount,
    membershipDiscountPercentage,
  });
  const lines = "lines" in obligation && Array.isArray(obligation.lines) ? obligation.lines : [];

  return {
    grossMinor: quoteInput.grossMinor,
    discountableBaseMinor: resolveLiveObligationDiscountableBaseMinor(obligation),
    memberDiscountPercentage: quoteInput.memberDiscount?.percentageApplied ?? 0,
    memberDiscountMinor: quoteInput.memberDiscount?.discountMinor ?? "0",
    payableMinor: quoteInput.payableMinor,
    currency: quoteInput.currency,
    source: quoteInput.source,
    lines,
  };
}

export async function handleCatalogCommercialPricingPreview(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const normalizedWorkspace = await resolveCommercialPricingWorkspace(req, auth.tenantId);
    if (normalizedWorkspace === null) {
      sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PRICING_UNAVAILABLE" });
      return;
    }
    const tourId = readQueryString(req, "tourId");
    if (tourId.length === 0) {
      sendHttpError(res, 400, { error: "bad_request", code: "TOUR_ID_REQUIRED" });
      return;
    }
    if (!isFinanceObligationBindingRegistered(normalizedWorkspace)) {
      sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PRICING_UNAVAILABLE" });
      return;
    }

    const preview = await resolveCommercialPricingPreview({
      tenantId: auth.tenantId,
      memberUserId: auth.userId,
      workspace: normalizedWorkspace,
      tourId,
      partySize: readPartySize(req),
      registrationIntake: readRegistrationIntake(req),
    });
    if (preview === null) {
      sendHttpError(res, 404, { error: "not_found", code: "TOUR_NOT_FOUND" });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      preview,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCatalogCommercialPricingPreviews(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const normalizedWorkspace = await resolveCommercialPricingWorkspace(req, auth.tenantId);
    if (normalizedWorkspace === null) {
      sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PRICING_UNAVAILABLE" });
      return;
    }
    if (!isFinanceObligationBindingRegistered(normalizedWorkspace)) {
      sendHttpError(res, 404, { error: "not_found", code: "WORKSPACE_PRICING_UNAVAILABLE" });
      return;
    }

    const tourIds = Array.from(new Set(readQueryStrings(req, "tourId"))).slice(0, 50);
    if (tourIds.length === 0) {
      sendHttpError(res, 400, { error: "bad_request", code: "TOUR_IDS_REQUIRED" });
      return;
    }

    const previews: Record<string, CommercialPricingPreviewDto> = {};
    await Promise.all(
      tourIds.map(async (tourId) => {
        const preview = await resolveCommercialPricingPreview({
          tenantId: auth.tenantId,
          memberUserId: auth.userId,
          workspace: normalizedWorkspace,
          tourId,
          partySize: readPartySize(req),
          registrationIntake: readRegistrationIntake(req),
        });
        if (preview !== null) {
          previews[tourId] = preview;
        }
      })
    );

    sendJson(res, 200, {
      ok: true,
      previews,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}
