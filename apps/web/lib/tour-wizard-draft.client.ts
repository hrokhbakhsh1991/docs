export type TourWizardDraftRecord = {
  id: string;
  currentStepIndex: number;
  payload: Record<string, unknown>;
  version: number;
  updatedAt: string;
};

export type TourWizardDraftEnvelope = {
  draft: TourWizardDraftRecord | null;
};

export type PatchTourWizardDraftBody = {
  currentStepIndex: number;
  payload: Record<string, unknown>;
  version: number;
};

export type PatchTourWizardDraftResult = {
  success: true;
  version: number;
};

/** Optimistic-lock generation used before the first successful server draft exists. */
export const TOUR_WIZARD_DRAFT_INITIAL_VERSION = 1;

export class TourWizardDraftStaleError extends Error {
  readonly code = "TOUR_WIZARD_DRAFT_STALE";
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "TourWizardDraftStaleError";
  }
}

function draftsPath(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/tours/drafts`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }
  const nested = (payload as { error?: { message?: unknown } }).error;
  const message = nested?.message;
  return typeof message === "string" && message.trim() !== "" ? message.trim() : fallback;
}

function readErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const code = (payload as { error?: { code?: unknown } }).error?.code;
  return typeof code === "string" ? code : undefined;
}

export async function fetchTourWizardDraft(workspaceId: string): Promise<TourWizardDraftEnvelope> {
  const res = await fetch(draftsPath(workspaceId), { credentials: "include" });
  if (!res.ok) {
    throw new Error(`fetchTourWizardDraft: ${res.status}`);
  }
  return (await res.json()) as TourWizardDraftEnvelope;
}

export async function patchTourWizardDraft(
  workspaceId: string,
  body: PatchTourWizardDraftBody,
): Promise<PatchTourWizardDraftResult> {
  const res = await fetch(draftsPath(workspaceId), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const payload = (await res.json().catch(() => null)) as unknown;
    const code = readErrorCode(payload);
    const message = readErrorMessage(
      payload,
      "پیش‌نویس در دستگاه دیگری به‌روزرسانی شده است. برای بارگذاری آخرین نسخه، همگام‌سازی را تازه کنید.",
    );
    if (code === "TOUR_WIZARD_DRAFT_STALE") {
      throw new TourWizardDraftStaleError(message);
    }
    throw new TourWizardDraftStaleError(message);
  }
  if (!res.ok) {
    throw new Error(`patchTourWizardDraft: ${res.status}`);
  }
  return (await res.json()) as PatchTourWizardDraftResult;
}

export async function deleteTourWizardDraft(workspaceId: string): Promise<void> {
  const res = await fetch(draftsPath(workspaceId), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`deleteTourWizardDraft: ${res.status}`);
  }
}
