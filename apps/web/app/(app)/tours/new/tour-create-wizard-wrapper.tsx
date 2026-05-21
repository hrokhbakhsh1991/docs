"use client";

import { Card, CardBody, LoadingState } from "@tour/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TourCreateWizard } from "@/components/tours/wizard/TourCreateWizard";
import { resolveTenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { resolveWizardDraftStorageKeyForBrowserHost } from "@/features/tours/wizard/tourWizardDraftEnvelope";
import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";
import {
  loadWizardPrefill,
  parseWizardPrefillQuery,
  wizardPrefillNeedsBootstrap,
} from "@/features/tours/wizard/sources";
import { useAuth } from "@/lib/auth/auth-context";
import { resolveTenantSlugFromHost } from "@/lib/tenant/runtime-tenant-context";
import { useTenantContext } from "@/lib/tenant/tenant-provider";
import { toursUseLiveApi } from "@/lib/services/tours.service";

const PREFILL_FETCH_TIMEOUT_MS = 15_000;

export function TourCreateWizardWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillQuery = parseWizardPrefillQuery(searchParams);
  const cloneTourId = prefillQuery.kind === "clone" ? prefillQuery.cloneTourId : null;
  const presetId = prefillQuery.kind === "preset" ? prefillQuery.presetId : null;
  const prefillBootstrapKey = useMemo(
    () => (cloneTourId ? `clone:${cloneTourId}` : presetId ? `preset:${presetId}` : "blank"),
    [cloneTourId, presetId],
  );
  const { user } = useAuth();
  const { tenantSlug: tenantSlugFromContext } = useTenantContext();
  const draftStorageKey = useTourWizardDraftStorageKey();
  const tenantFormContract = resolveTenantTourFormContract(user?.tenantModules);
  const [isLoading, setIsLoading] = useState(() => wizardPrefillNeedsBootstrap(prefillQuery));
  const [wizardBootstrapKey, setWizardBootstrapKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const liveApi = toursUseLiveApi();
  const preparedBootstrapKeyRef = useRef<string | null>(null);
  const tenantFormContractRef = useRef(tenantFormContract);
  tenantFormContractRef.current = tenantFormContract;
  const draftStorageKeyRef = useRef(draftStorageKey);
  draftStorageKeyRef.current = draftStorageKey;

  useEffect(() => {
    if (wizardPrefillNeedsBootstrap(prefillQuery)) {
      setIsLoading(true);
      setError(null);
    }
  }, [prefillBootstrapKey, prefillQuery]);

  useEffect(() => {
    if (!wizardPrefillNeedsBootstrap(prefillQuery)) {
      setIsLoading(false);
      return;
    }
    if (preparedBootstrapKeyRef.current === prefillBootstrapKey) {
      setIsLoading(false);
      return;
    }
    if (prefillQuery.kind === "clone" && !liveApi) {
      setIsLoading(false);
      setError("کپی‌کردن تور در این محیط در دسترس نیست (API پیکربندی نشده).");
      return;
    }

    const abort = new AbortController();
    let fetchTimedOut = false;
    let effectActive = true;
    const fetchTimeoutId = window.setTimeout(() => {
      fetchTimedOut = true;
      abort.abort();
    }, PREFILL_FETCH_TIMEOUT_MS);

    void (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const tenantSlug =
          tenantSlugFromContext?.trim() ||
          (typeof window !== "undefined"
            ? resolveTenantSlugFromHost(window.location.host)
            : null);

        const loaded = await loadWizardPrefill(prefillQuery, {
          tenantSlug,
          tenantFormContract: tenantFormContractRef.current,
          signal: abort.signal,
        });

        if (!effectActive || !loaded) {
          return;
        }

        const storageKey = resolveWizardDraftStorageKeyForBrowserHost(draftStorageKeyRef.current);
        localStorage.setItem(storageKey, loaded.serializedDraft);

        preparedBootstrapKeyRef.current = prefillBootstrapKey;
        setWizardBootstrapKey((k) => k + 1);
        router.replace("/tours/new");
      } catch (err) {
        if (!effectActive) {
          return;
        }
        if (abort.signal.aborted && !fetchTimedOut) {
          return;
        }
        const errorMessage = fetchTimedOut
          ? prefillQuery.kind === "clone"
            ? "زمان بارگذاری تور برای کپی‌کردن به پایان رسید"
            : "زمان بارگذاری قالب تور به پایان رسید"
          : err instanceof Error
            ? err.message
            : prefillQuery.kind === "clone"
              ? "خطای نامشخصی در بارگذاری تور رخ داد"
              : "خطا در بارگذاری قالب تور";
        setError(errorMessage);
      } finally {
        window.clearTimeout(fetchTimeoutId);
        if (effectActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      effectActive = false;
      window.clearTimeout(fetchTimeoutId);
      abort.abort();
    };
  }, [prefillBootstrapKey, prefillQuery, liveApi, router, tenantSlugFromContext]);

  if (error) {
    return (
      <Card>
        <CardBody>
          <div
            role="alert"
            style={{
              padding: "1rem",
              borderRadius: 8,
              background: "var(--color-danger-50, #fef2f2)",
              color: "var(--color-danger-800, #991b1b)",
            }}
          >
            <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
              {prefillQuery.kind === "preset" ? "خطا در بارگذاری قالب" : "خطا در کپی‌کردن تور"}
            </p>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <LoadingState
            message={
              presetId && !cloneTourId
                ? "در حال بارگذاری قالب تور…"
                : "در حال بارگذاری تور برای کپی‌کردن…"
            }
          />
        </CardBody>
      </Card>
    );
  }

  return <TourCreateWizard key={wizardBootstrapKey} />;
}
