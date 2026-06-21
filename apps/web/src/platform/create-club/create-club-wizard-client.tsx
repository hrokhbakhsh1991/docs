"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PlatformErrorState, PlatformLoadingState } from "../platform-async-states";
import { fetchPlatformApi } from "../platform-api-client";
import { StepIdentity } from "./step-identity";
import { StepOwner } from "./step-owner";
import { StepReview } from "./step-review";
import { StepSites } from "./step-sites";
import { submitCreateClubRequest } from "./submit-create-club";
import { useCreateClubWizard } from "./use-create-club-wizard.hook";
import type { WorkspaceOption } from "./use-create-club-wizard";
import { validateIdentityStep } from "./validate-identity-step";
import { validateOwnerPhoneClient } from "./validate-owner-phone";

const STEP_TITLES = ["Identity", "Sites", "Owner", "Review"] as const;

type WorkspacesResponse = {
  workspaces?: Array<{ id?: string; displayName?: string }>;
};

export function CreateClubWizardClient() {
  const router = useRouter();
  const { step, draft, setDraft, next, back } = useCreateClubWizard();
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceOption[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingWorkspaces(true);
      setLoadError(null);
      try {
        const response = await fetchPlatformApi("/workspaces");
        const body = (await response.json().catch(() => ({}))) as WorkspacesResponse;
        if (!response.ok) {
          throw new Error("Failed to load workspaces");
        }
        const items = Array.isArray(body.workspaces) ? body.workspaces : [];
        const options = items
          .filter((item): item is { id: string; displayName?: string } => typeof item?.id === "string")
          .map((item) => ({ id: item.id, displayName: item.displayName }));
        if (!cancelled) {
          setWorkspaces(options);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load workspaces");
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchDraft = useCallback(
    (patch: Partial<typeof draft>) => {
      setDraft((current) => ({ ...current, ...patch }));
      setStepError(null);
    },
    [setDraft]
  );

  const handleNext = useCallback(() => {
    if (step === 1) {
      const error = validateIdentityStep(draft, workspaces);
      if (error) {
        setStepError(error);
        return;
      }
    }
    if (step === 3) {
      const error = validateOwnerPhoneClient(draft.ownerPhone);
      if (error) {
        setStepError(error);
        return;
      }
    }
    setStepError(null);
    next();
  }, [step, draft, workspaces, next]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setStepError(null);
    try {
      const result = await submitCreateClubRequest(draft);
      if (!result.ok) {
        setStepError(result.message);
        return;
      }
      router.push(result.redirectPath);
    } catch {
      setStepError("Failed to create club");
    } finally {
      setSubmitting(false);
    }
  }, [draft, router]);

  if (loadingWorkspaces) {
    return <PlatformLoadingState message="Loading workspaces…" />;
  }

  if (loadError) {
    return <PlatformErrorState message={loadError} />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6" data-create-club-wizard>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Step {step} of 4 — {STEP_TITLES[step - 1]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Create club</h1>
      </div>

      {step === 1 ? (
        <StepIdentity draft={draft} workspaces={workspaces} onChange={patchDraft} error={stepError} />
      ) : null}
      {step === 2 ? <StepSites subdomain={draft.subdomain} /> : null}
      {step === 3 ? <StepOwner draft={draft} onChange={patchDraft} error={stepError} /> : null}
      {step === 4 ? (
        <StepReview
          draft={draft}
          submitting={submitting}
          error={stepError}
          onConfirm={handleConfirm}
        />
      ) : null}

      {step < 4 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm disabled:opacity-40"
            disabled={step === 1}
            onClick={back}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={handleNext}
          >
            Continue
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm"
          disabled={submitting}
          onClick={back}
        >
          Back
        </button>
      )}
    </div>
  );
}
