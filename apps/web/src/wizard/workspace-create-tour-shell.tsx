"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useAppSession } from "@/providers/app-session-context";
import { createTourAction } from "@/tours/create-tour.server";
import { emptyTourWizardDraft } from "@/tours/tour-wizard-draft";
import {
  resolveCloneTourId,
  shouldSkipWizardTemplatePrefill,
} from "@/tours/tour-clone-hydrate-logic";
import {
  applyTourPresetToDraft,
  findActiveTourPreset,
  resolvePresetId,
  TOUR_PRESET_PREFILL_TEST_IDS,
} from "@/tours/tour-preset-prefill-logic";
import {
  resolveWizardTemplateGateState,
  WIZARD_TEMPLATE_GATE_TEST_IDS,
  type WizardTemplateGateState,
} from "@/tours/wizard-template-gate-logic";
import {
  applyWizardTemplatePrefillToDraft,
  WIZARD_TEMPLATE_PREFILL_TEST_IDS,
} from "@/tours/wizard-template-prefill-logic";
import type { TourPresetResource, TourThemeResource } from "@/features/settings/settings-module-types";
import { readActiveThemeIds } from "@/wizard/denali/denali-catalog-sanitize";
import { WorkspaceWizardHost } from "@/wizard/workspace-wizard-host";

const INITIAL_GATE_STATE: WizardTemplateGateState = {
  loading: true,
  published: false,
  allowedCanonicalPaths: [],
  templateSteps: [],
  fieldOverlays: new Map(),
  seedLabel: "",
  fieldRulesOverlay: {},
  workspaceFormProfile: "denali_pilot",
};

function buildPrefilledForm(
  gate: WizardTemplateGateState,
  pluginId: string
): ReturnType<typeof emptyTourWizardDraft> {
  return applyWizardTemplatePrefillToDraft(
    emptyTourWizardDraft(),
    gate.seedLabel,
    gate.fieldOverlays,
    pluginId
  );
}

/** Generic create-tour wizard for non-Denali workspace plugins (Phase 13.4). */
export function WorkspaceCreateTourWizardShell() {
  const t = useTranslations("wizard");
  const searchParams = useSearchParams();
  const session = useAppSession();
  const cloneTourId = useMemo(
    () => resolveCloneTourId(searchParams.get("clone")),
    [searchParams]
  );
  const presetId = useMemo(() => resolvePresetId(searchParams.get("preset")), [searchParams]);
  const [localDraft, setLocalDraft] = useState(() => emptyTourWizardDraft());
  const [localStepIndex, setLocalStepIndex] = useState(0);
  const [gate, setGate] = useState<WizardTemplateGateState>(INITIAL_GATE_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTourId, setCreatedTourId] = useState<string | null>(null);
  const [presetApplied, setPresetApplied] = useState(false);
  const [pending, startTransition] = useTransition();
  const appliedPresetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/tour-wizard-template", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setGate(resolveWizardTemplateGateState(payload, session.pluginId));
      })
      .catch(() => {
        if (!cancelled) {
          setGate({
            loading: false,
            published: false,
            allowedCanonicalPaths: [],
            templateSteps: [],
            fieldOverlays: new Map(),
            seedLabel: "",
            fieldRulesOverlay: {},
            workspaceFormProfile: "denali_pilot",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  useEffect(() => {
    if (!gate.published) {
      return;
    }
    if (shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId)) {
      return;
    }
    setLocalDraft(buildPrefilledForm(gate, session.pluginId));
  }, [gate, session.pluginId, cloneTourId]);

  useEffect(() => {
    if (!presetId || !gate.published || cloneTourId !== null) {
      appliedPresetIdRef.current = null;
      setPresetApplied(false);
      return;
    }
    if (appliedPresetIdRef.current === presetId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetch("/api/settings/resources/tour_presets", { cache: "no-store" }),
      fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    ])
      .then(async ([presetsRes, themesRes]) => {
        if (!presetsRes.ok) {
          return null;
        }
        const presetsPayload = (await presetsRes.json()) as { items?: readonly TourPresetResource[] };
        const themesPayload =
          themesRes.ok
            ? ((await themesRes.json()) as { items?: readonly TourThemeResource[] })
            : { items: [] as readonly TourThemeResource[] };
        const preset = findActiveTourPreset(presetsPayload.items ?? [], presetId);
        if (preset == null) {
          return null;
        }
        const activeThemeIds = readActiveThemeIds(themesPayload.items ?? []);
        return { preset, activeThemeIds };
      })
      .then((resolved) => {
        if (cancelled || resolved == null) {
          return;
        }
        appliedPresetIdRef.current = presetId;
        const applyPreset = (base: ReturnType<typeof emptyTourWizardDraft>) =>
          applyTourPresetToDraft(base, resolved.preset, resolved.activeThemeIds);
        setLocalDraft((current) => applyPreset(current));
        setPresetApplied(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPresetApplied(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [presetId, gate, cloneTourId]);

  const showSeedBanner =
    gate.seedLabel.length > 0 &&
    !shouldSkipWizardTemplatePrefill(cloneTourId, session.pluginId);

  const onSubmit = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createTourAction({ data: localDraft.data });
      if (!result.ok) {
        setSubmitError(t("submit.errorGeneric", { status: result.status, code: result.code }));
        return;
      }
      setCreatedTourId(result.record.id);
    });
  };

  if (gate.loading) {
    return (
      <div data-new-tour-wizard>
        <p className="new-tour-wizard-page__loading" data-workspace-wizard-loading>
          {t("loading")}
        </p>
      </div>
    );
  }

  if (!gate.published) {
    return (
      <div data-new-tour-wizard>
        <section className="new-tour-wizard-page__empty" data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.emptyState}>
          <h1 className="new-tour-wizard-page__empty-title">{t("notConfigured.title")}</h1>
          <p className="new-tour-wizard-page__empty-desc">{t("notConfigured.description")}</p>
          <Button asChild data-testid={WIZARD_TEMPLATE_GATE_TEST_IDS.configureLink}>
            <Link href="/settings/tour-wizard-template">{t("notConfigured.configureLink")}</Link>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="new-tour-wizard-page" data-new-tour-wizard>
      <header className="new-tour-wizard-page__header">
        <div className="new-tour-wizard-page__header-main">
          <div className="new-tour-wizard-page__header-copy">
            <h1 className="new-tour-wizard-page__title">{t("pageTitle")}</h1>
            <p className="new-tour-wizard-page__subtitle">{t("pageSubtitle")}</p>
          </div>
        </div>
      </header>
      {showSeedBanner ? (
        <p
          className="new-tour-wizard-page__seed-banner"
          data-testid={WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedApplied}
          data-seed-label={gate.seedLabel}
        >
          {t("seedApplied", { label: gate.seedLabel })}
        </p>
      ) : null}
      {presetApplied && presetId ? (
        <p
          className="new-tour-wizard-page__seed-banner"
          data-testid={TOUR_PRESET_PREFILL_TEST_IDS.applied}
          data-preset-id={presetId}
        >
          {t("presetApplied")}
        </p>
      ) : null}
      <WorkspaceWizardHost
        pluginId={session.pluginId}
        tenantId={session.tenantId}
        workspaceId={session.workspaceId}
        authz={session.authz}
        draft={localDraft}
        onDraftChange={setLocalDraft}
        allowedCanonicalPaths={gate.allowedCanonicalPaths}
        templateSteps={gate.templateSteps}
        activeStepIndex={localStepIndex}
        onActiveStepIndexChange={setLocalStepIndex}
        renderFooter={() => (
          <div data-wizard-footer>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? t("creating") : t("createButton")}
            </Button>
            {submitError ? (
              <p role="alert" data-tour-create-error>
                {submitError}
              </p>
            ) : null}
            {createdTourId ? (
              <p data-tour-created>
                {t("created", { id: createdTourId })}
              </p>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
