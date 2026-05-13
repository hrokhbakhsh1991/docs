"use client";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";
import { Card, CardBody, LoadingState } from "@tour/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TourCreateWizard } from "@/components/tours/wizard/TourCreateWizard";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import {
  WIZARD_DRAFT_STORAGE_KEY,
  serializeWizardDraft,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { getTourThemes, type SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
import { toursUseLiveApi } from "@/lib/services/tours.service";

function readCloneTourIdFromWindow(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const id = new URLSearchParams(window.location.search).get("clone")?.trim();
    return id && id !== "" ? id : null;
  } catch {
    return null;
  }
}

export function TourCreateWizardWrapper() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveApi = toursUseLiveApi();

  useEffect(() => {
    const cloneTourId = readCloneTourIdFromWindow();
    if (!cloneTourId) {
      setIsLoading(false);
      return;
    }
    if (!liveApi) {
      setIsLoading(false);
      setError("کپی‌کردن تور در این محیط در دسترس نیست (API پیکربندی نشده).");
      return;
    }

    const loadAndPrepareClonedTour = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the tour to clone
        const response = await fetch(`/api/tours/${cloneTourId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

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
          themes = await getTourThemes();
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
          localStorage.setItem(
            WIZARD_DRAFT_STORAGE_KEY,
            serializeWizardDraft(filteredPatch ?? wizardData, wizardMeta),
          );
        } catch {
          console.warn("Failed to save cloned tour to localStorage");
        }

        router.replace("/tours/new");
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "خطای نامشخصی در بارگذاری تور رخ داد";
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    loadAndPrepareClonedTour();
  }, [liveApi, router]);

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
