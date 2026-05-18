"use client";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { Card, CardBody, LoadingState } from "@tour/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TourCreateWizard } from "@/components/tours/wizard/TourCreateWizard";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { resolveTenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import {
  resolveWizardDraftStorageKeyForBrowserHost,
  serializeWizardDraft,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { useAuth } from "@/lib/auth/auth-context";
import { getTourThemes, type SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
import { toursUseLiveApi } from "@/lib/services/tours.service";

export function TourCreateWizardWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneTourId = searchParams.get("clone")?.trim() || null;
  const { user } = useAuth();
  const draftStorageKey = useTourWizardDraftStorageKey();
  const tenantFormContract = resolveTenantTourFormContract(user?.tenantModules);
  const [isLoading, setIsLoading] = useState(() => Boolean(cloneTourId));
  const [error, setError] = useState<string | null>(null);
  const liveApi = toursUseLiveApi();
  const clonePreparedRef = useRef(false);
  const tenantFormContractRef = useRef(tenantFormContract);
  tenantFormContractRef.current = tenantFormContract;
  const draftStorageKeyRef = useRef(draftStorageKey);
  draftStorageKeyRef.current = draftStorageKey;

  useEffect(() => {
    if (!cloneTourId) {
      setIsLoading(false);
      return;
    }
    if (clonePreparedRef.current) {
      setIsLoading(false);
      return;
    }
    if (!liveApi) {
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
    }, 15_000);

    const loadAndPrepareClonedTour = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/tours/${cloneTourId}`, {
          method: "GET",
          credentials: "include",
          signal: abort.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!effectActive) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "تور برای کپی‌کردن یافت نشد"
              : `خطا در بارگذاری تور: ${response.status}`,
          );
        }

        const tour = await response.json();

        // Phase-2 pipeline migration for clone bootstrap. The previous flow built the
        // resolved profile inline (default-from-tourType, then catalog lookup) and stored
        // the **unfiltered** `wizardData` in localStorage — leaking inactive-group ghost
        // data for any source tour whose profile differed from the workspace's mapping of
        // its theme. `applyTourWizardPatch` runs the same `resolveTourFormProfile`
        // (snapshot/theme/tourType/default chain) but additionally filters & sanitizes the
        // patch against the FINAL profile so the on-disk envelope is symmetric with the
        // submit-time strip in `useTourWizardCreate` and with the auto-save sanitize hook.
        const wizardData = transformTourToWizardValues(tour);

        let themes: SettingsTourThemeDto[] = [];
        try {
          themes = await Promise.race([
            getTourThemes(),
            new Promise<SettingsTourThemeDto[]>((_, reject) => {
              window.setTimeout(() => reject(new Error("theme catalog timeout")), 8_000);
            }),
          ]);
        } catch {
          // Theme catalog is optional for clone; pipeline falls back through tourType.
        }

        const { filteredPatch, resolvedFormProfile } = applyTourWizardPatch({
          baseValues: buildTourCreateFormDefaultValues(),
          patch: wizardData,
          // Pipeline re-resolves whenever the patch carries mainTourThemeId or tourType
          // (always true for transform output); this `currentProfile` is the contractual
          // fallback only used when neither is present.
          currentProfile: "general",
          themeCatalog: themes,
          tourType: wizardData.overview?.tourType,
          tenantFormContract: tenantFormContractRef.current,
        });

        const mainThemeId = wizardData.overview?.mainTourThemeId?.trim();
        const secondaries = wizardData.overview?.secondaryTourThemeIds ?? [];
        const wizardMeta: TourWizardDraftMeta = {
          sourceTourId: cloneTourId,
          themeIds: {
            main: mainThemeId || undefined,
            secondary: secondaries.length > 0 ? secondaries : undefined,
          },
          resolvedFormProfile,
          formProfileVersion: TOUR_FORM_PROFILE_VERSION,
        };

        try {
          // Serialize the filtered patch (not the merged form): keeps the LS payload
          // minimal and shape-compatible with what auto-save writes (also a Partial). The
          // restore path will re-merge onto fresh defaults via the same pipeline.
          const storageKey = resolveWizardDraftStorageKeyForBrowserHost(draftStorageKeyRef.current);
          localStorage.setItem(
            storageKey,
            serializeWizardDraft(filteredPatch ?? wizardData, wizardMeta),
          );
        } catch {
          console.warn("Failed to save cloned tour to localStorage");
        }

        if (!effectActive) {
          return;
        }
        clonePreparedRef.current = true;
        router.replace("/tours/new");
      } catch (err) {
        if (!effectActive) {
          return;
        }
        if (abort.signal.aborted && !fetchTimedOut) {
          return;
        }
        const errorMessage = fetchTimedOut
          ? "زمان بارگذاری تور برای کپی‌کردن به پایان رسید"
          : err instanceof Error
            ? err.message
            : "خطای نامشخصی در بارگذاری تور رخ داد";
        setError(errorMessage);
      } finally {
        window.clearTimeout(fetchTimeoutId);
        setIsLoading(false);
      }
    };

    void loadAndPrepareClonedTour();
    return () => {
      effectActive = false;
      window.clearTimeout(fetchTimeoutId);
      abort.abort();
    };
  }, [cloneTourId, liveApi, router]);

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
              خطا در کپی‌کردن تور
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
          <LoadingState message="در حال بارگذاری تور برای کپی‌کردن…" />
        </CardBody>
      </Card>
    );
  }

  return <TourCreateWizard />;
}
