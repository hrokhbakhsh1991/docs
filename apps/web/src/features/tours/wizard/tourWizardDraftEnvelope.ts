import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import { resolveTenantSlugFromHost } from "@/lib/tenant/runtime-tenant-context";

import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";
import { parseTourWizardDraftMeta } from "./tourWizardProfileResolve";
import { TOUR_WIZARD_CONTRACT_VERSION } from "./contract/tour-wizard-contract-version";

/** Legacy global key (pre–tenant-scoped drafts). Migrated on first read per workspace. */
export const WIZARD_DRAFT_STORAGE_KEY_LEGACY = "tour-create-wizard-draft-v1";

/** @deprecated Use {@link wizardDraftStorageKey} with workspace scope. */
export const WIZARD_DRAFT_STORAGE_KEY = WIZARD_DRAFT_STORAGE_KEY_LEGACY;

/** Prefer workspace host label for browser writes (stable across JWT hydrate). */
export function resolveWizardDraftStorageKeyForBrowserHost(fallbackKey: string): string {
  if (typeof window === "undefined") {
    return fallbackKey;
  }
  const slug = resolveTenantSlugFromHost(window.location.host);
  return slug ? wizardDraftStorageKey(slug) : fallbackKey;
}

export function wizardDraftStorageKey(tenantScope: string): string {
  const scope = tenantScope.trim().toLowerCase();
  if (!scope) {
    return WIZARD_DRAFT_STORAGE_KEY_LEGACY;
  }
  return `${WIZARD_DRAFT_STORAGE_KEY_LEGACY}:${scope}`;
}

export type ParsedWizardDraft = {
  formPatch: Partial<TourCreateFormValues>;
  wizardMeta?: TourWizardDraftMeta;
};

type ParsedDraft = ParsedWizardDraft;

/**
 * Parses localStorage JSON: either legacy flat `Partial<TourCreateFormValues>` or envelope with `_wizardMeta`.
 */
export function parseWizardDraftRecord(raw: string | null): ParsedDraft | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const wizardMeta = parseTourWizardDraftMeta(parsed);
    const { _wizardMeta: _m, ...rest } = parsed;
    return { formPatch: rest as Partial<TourCreateFormValues>, wizardMeta };
  } catch {
    return null;
  }
}

export function serializeWizardDraft(
  formValues: Partial<TourCreateFormValues>,
  wizardMeta: TourWizardDraftMeta | undefined,
): string {
  const base = { ...(formValues as Record<string, unknown>) };
  if (wizardMeta) {
    base._wizardMeta = {
      ...wizardMeta,
      wizardContractVersion: TOUR_WIZARD_CONTRACT_VERSION,
    };
  }
  return JSON.stringify(base);
}

export function removeWizardDraftFromStorage(tenantScope: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(wizardDraftStorageKey(tenantScope));
  } catch {
    /* ignore */
  }
}

export function removeLegacyWizardDraftFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY_LEGACY);
  } catch {
    /* ignore */
  }
}

function looksLikeTenantIdScope(scope: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope);
}

/**
 * Reads scoped draft; if missing, migrates legacy global envelope into scoped key once.
 */
export function readWizardDraftRecordForScope(tenantScope: string): ParsedDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const scope = tenantScope.trim();
  const scopedKey = wizardDraftStorageKey(scope);
  try {
    const scoped = parseWizardDraftRecord(window.localStorage.getItem(scopedKey));
    if (scoped) {
      return scoped;
    }
    if (looksLikeTenantIdScope(scope)) {
      const hostSlug = resolveTenantSlugFromHost(window.location.host);
      if (hostSlug && hostSlug !== scope) {
        const fromHost = readWizardDraftRecordForScope(hostSlug);
        if (fromHost) {
          return fromHost;
        }
      }
    }
    const legacy = parseWizardDraftRecord(
      window.localStorage.getItem(WIZARD_DRAFT_STORAGE_KEY_LEGACY),
    );
    if (!legacy || !scope) {
      return legacy;
    }
    window.localStorage.setItem(
      scopedKey,
      serializeWizardDraft(legacy.formPatch, legacy.wizardMeta),
    );
    window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY_LEGACY);
    return legacy;
  } catch {
    return null;
  }
}
