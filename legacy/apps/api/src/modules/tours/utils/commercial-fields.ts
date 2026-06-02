import { BadRequestException } from "@nestjs/common";

import {
  DECIMAL_MAJOR_REGEX,
  DEFAULT_CATALOG_CURRENCY_CODE,
  getIso4217MinorUnitExponent,
  MajorAmountScaleError,
  majorAmountStringToMinorUnits,
  normalizeCurrencyCode,
} from "@repo/shared-contracts";

import type { TourTripDetails } from "../types/tour-trip-details.types";
import type { TourDetailsPolicySnapshot } from "../domain/tour-policy.types";

export type CatalogCurrencyResolutionOptions = {
  /** Workspace `tenants.operating_currency_code` or tour denormalized column. */
  workspaceCurrencyCode?: string | null;
  /** Prior tour row currency when patching without `cost_context.currency`. */
  tourCurrencyCode?: string | null;
};

export function extractTripLogisticsDates(details: TourDetailsPolicySnapshot | undefined | null): {
  startsOn: string | null;
  endsOn: string | null;
} {
  const td = details?.tripDetails as TourTripDetails | undefined;
  const dep = td?.logistics?.departureDate;
  const ret = td?.logistics?.returnDate;
  const ymd = (s: unknown): string | null =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  return { startsOn: ymd(dep), endsOn: ymd(ret) };
}

/**
 * Resolves catalog currency: `cost_context.currency` → tour hint → workspace hint → USD (sync fallback).
 * For write-path denormalization prefer {@link resolveCatalogCurrencyForDenormalization}.
 */
export function currencyCodeFromCostContext(
  cost: Record<string, unknown> | undefined,
  options?: CatalogCurrencyResolutionOptions,
): string {
  const fromCost = cost?.currency;
  if (typeof fromCost === "string" && fromCost.trim()) {
    return normalizeCurrencyCode(fromCost);
  }
  if (typeof options?.tourCurrencyCode === "string" && options.tourCurrencyCode.trim()) {
    return normalizeCurrencyCode(options.tourCurrencyCode);
  }
  if (typeof options?.workspaceCurrencyCode === "string" && options.workspaceCurrencyCode.trim()) {
    return normalizeCurrencyCode(options.workspaceCurrencyCode);
  }
  return DEFAULT_CATALOG_CURRENCY_CODE;
}

export type CatalogCurrencyDenormalizationOptions = CatalogCurrencyResolutionOptions & {
  tenantId: string;
  resolveOperatingCurrencyCode: (tenantId: string) => Promise<string>;
};

/**
 * Write-path currency resolution: cost_context → prior tour column → tenant operating currency.
 */
export async function resolveCatalogCurrencyForDenormalization(
  cost: Record<string, unknown> | undefined,
  options: CatalogCurrencyDenormalizationOptions,
): Promise<string> {
  const fromCost = cost?.currency;
  if (typeof fromCost === "string" && fromCost.trim()) {
    return normalizeCurrencyCode(fromCost);
  }
  if (typeof options.tourCurrencyCode === "string" && options.tourCurrencyCode.trim()) {
    return normalizeCurrencyCode(options.tourCurrencyCode);
  }
  if (typeof options.workspaceCurrencyCode === "string" && options.workspaceCurrencyCode.trim()) {
    return normalizeCurrencyCode(options.workspaceCurrencyCode);
  }
  const tenantId = options.tenantId.trim();
  if (tenantId) {
    return normalizeCurrencyCode(await options.resolveOperatingCurrencyCode(tenantId));
  }
  return DEFAULT_CATALOG_CURRENCY_CODE;
}

export type TourCommercialDenormalizationTarget = {
  costContext?: Record<string, unknown> | null;
  currencyCode?: string | null;
  listPriceMinor?: string | null;
};

/** Sets `currencyCode` and `listPriceMinor` from cost_context using tenant operating currency fallback. */
export async function applyDenormalizedTourCommercialColumns(
  tour: TourCommercialDenormalizationTarget,
  tenantId: string,
  resolveOperatingCurrencyCode: (tenantId: string) => Promise<string>,
): Promise<void> {
  if (!tour.costContext || typeof tour.costContext !== "object") {
    return;
  }
  const currency = await resolveCatalogCurrencyForDenormalization(tour.costContext, {
    tenantId,
    tourCurrencyCode: tour.currencyCode,
    resolveOperatingCurrencyCode,
  });
  tour.currencyCode = currency;
  tour.listPriceMinor =
    listPriceMinorFromCostContext(tour.costContext, { currencyCode: currency }) ?? undefined;
}

export type ListPriceMinorOptions = CatalogCurrencyResolutionOptions & {
  /** When set, skips resolution and uses this code for exponent lookup. */
  currencyCode?: string | null;
};

function totalCostToMajorString(value: unknown): string | null {
  if (typeof value === "string" && DECIMAL_MAJOR_REGEX.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    const asStr = String(value);
    if (DECIMAL_MAJOR_REGEX.test(asStr)) {
      return asStr;
    }
  }
  return null;
}

function isPositiveDecimalString(value: string): boolean {
  if (value === "0" || /^0+\.0+$/.test(value)) {
    return false;
  }
  return true;
}

/** Minor units as decimal string for TypeORM `bigint` columns (ISO 4217 exponent, not fixed ×100). */
export function listPriceMinorFromCostContext(
  cost: Record<string, unknown> | undefined,
  options?: ListPriceMinorOptions,
): string | null {
  if (!cost) {
    return null;
  }
  const majorStr = totalCostToMajorString(cost.totalCost);
  if (majorStr == null) {
    return null;
  }

  const currency =
    options?.currencyCode != null && String(options.currencyCode).trim() !== ""
      ? normalizeCurrencyCode(options.currencyCode)
      : currencyCodeFromCostContext(cost, options);

  const exponent = getIso4217MinorUnitExponent(currency);
  if (exponent === 0) {
    const [, fractionalPart = ""] = majorStr.split(".");
    if (fractionalPart.length > 0 && !/^0+$/.test(fractionalPart)) {
      throw new BadRequestException({
        error: {
          code: "FINANCIAL_NUMERIC_PRECISION_INVALID",
          message:
            "totalCost must be a whole-number amount for zero-decimal currencies (e.g. IRR, IRT).",
        },
      });
    }
  }

  try {
    return majorAmountStringToMinorUnits(majorStr, currency);
  } catch (error: unknown) {
    if (error instanceof MajorAmountScaleError && error.code === "FINANCIAL_NUMERIC_OVERFLOW_LIMIT") {
      throw new BadRequestException({
        error: {
          code: "FINANCIAL_NUMERIC_OVERFLOW_LIMIT",
          message: error.message,
        },
      });
    }
    return null;
  }
}

export { isPositiveDecimalString };
