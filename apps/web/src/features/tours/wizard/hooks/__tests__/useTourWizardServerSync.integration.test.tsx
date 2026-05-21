/**
 * Integration: 500ms debounced PATCH, draft version OCC bump, 409 conflict surface.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject, ReactNode } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import {
  fetchTourWizardDraft,
  patchTourWizardDraft,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
  TourWizardDraftStaleError,
} from "@/lib/tour-wizard-draft.client";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { serializeDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import { useTourWizardServerSync } from "../useTourWizardServerSync";

jest.mock("@/lib/tour-wizard-draft.client", () => {
  const actual = jest.requireActual<typeof import("@/lib/tour-wizard-draft.client")>(
    "@/lib/tour-wizard-draft.client",
  );
  return {
    ...actual,
    patchTourWizardDraft: jest.fn(),
    fetchTourWizardDraft: jest.fn(),
  };
});

const patchMock = patchTourWizardDraft as jest.MockedFunction<typeof patchTourWizardDraft>;
const fetchMock = fetchTourWizardDraft as jest.MockedFunction<typeof fetchTourWizardDraft>;

const WORKSPACE_ID = "ws-integration-test";
const WIZARD_META: TourWizardDraftMeta = {
  resolvedFormProfile: "mountain_outdoor",
  formProfileVersion: 1,
};

let formInstance: UseFormReturn<DenaliCreateTourWizardForm>;
let draftVersionRef: MutableRefObject<number>;
const wizardMetaRef: MutableRefObject<TourWizardDraftMeta | undefined> = { current: WIZARD_META };

function Wrapper({ children }: { children: ReactNode }) {
  const form = useForm<DenaliCreateTourWizardForm>({
    defaultValues: buildDenaliTourCreateDefaultValues(),
  });
  formInstance = form;
  return <>{children}</>;
}

function renderSyncHarness(initialVersion = 2) {
  draftVersionRef = { current: initialVersion };
  return renderHook(
    () =>
      useTourWizardServerSync({
        workspaceId: WORKSPACE_ID,
        form: formInstance,
        currentStepIndex: 0,
        wizardMetaRef,
        enabled: true,
        draftVersionRef,
      }),
    { wrapper: Wrapper },
  );
}

function bumpTitle(suffix: string) {
  act(() => {
    formInstance.setValue("basicInfo.title", `denali-sync-${suffix}`, { shouldDirty: true });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  patchMock.mockReset();
  fetchMock.mockReset();
  patchMock.mockResolvedValue({ success: true, version: 3 });
  fetchMock.mockResolvedValue({ draft: { version: 5 } } as never);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("useTourWizardServerSync", () => {
  test("Scenario A: debounces rapid form edits — one PATCH after 500ms", async () => {
    renderSyncHarness(2);

    bumpTitle("a");
    bumpTitle("b");
    bumpTitle("c");

    expect(patchMock).not.toHaveBeenCalled();
    expect(formInstance.getValues("basicInfo.title")).toBe("denali-sync-c");

    await act(async () => {
      jest.advanceTimersByTime(499);
    });
    expect(patchMock).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(1);
    });

    expect(patchMock.mock.calls[0]?.[0]).toBe(WORKSPACE_ID);
    expect(patchMock.mock.calls[0]?.[1]).toMatchObject({
      currentStepIndex: 0,
      version: 2,
      payload: expect.objectContaining({
        basicInfo: expect.objectContaining({ title: "denali-sync-c" }),
      }),
    });
  });

  test("Scenario B: successful PATCH bumps draftVersionRef to server version", async () => {
    const { result } = renderSyncHarness(2);

    bumpTitle("version-bump");

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(1);
    });

    expect(draftVersionRef.current).toBe(3);
    expect(result.current.syncConflict).toBe(false);
    expect(result.current.syncSettled).toBe(true);

    result.current.noteDraftVersion(5);
    expect(draftVersionRef.current).toBe(5);

    result.current.noteDraftVersion(null);
    expect(draftVersionRef.current).toBe(TOUR_WIZARD_DRAFT_INITIAL_VERSION);
  });

  test("Scenario C: 409 stale draft sets syncConflict and pauses further PATCH spam", async () => {
    patchMock.mockRejectedValueOnce(
      new TourWizardDraftStaleError("پیش‌نویس در دستگاه دیگری به‌روزرسانی شده است."),
    );

    const { result } = renderSyncHarness(2);

    bumpTitle("conflict");

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(result.current.syncConflict).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(draftVersionRef.current).toBe(5);
    expect(result.current.syncConflictMessage).toContain("دستگاه دیگری");
    expect(patchMock).toHaveBeenCalledTimes(1);

    bumpTitle("while-conflict");
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(patchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearSyncConflict();
    });
    expect(result.current.syncConflict).toBe(false);

    bumpTitle("after-conflict");
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(2);
    });
    expect(patchMock.mock.calls[1]?.[1]?.version).toBe(5);
  });

  test("Scenario D: 409 self-heal auto-retries when server is one version ahead with aligned payload", async () => {
    patchMock
      .mockRejectedValueOnce(new TourWizardDraftStaleError("stale version"))
      .mockResolvedValueOnce({ success: true, version: 4 });

    fetchMock.mockImplementation(async () => {
      const payload = JSON.parse(
        serializeDenaliWizardDraft(formInstance.getValues(), WIZARD_META),
      ) as Record<string, unknown>;
      return {
        draft: {
          id: "draft-self-heal",
          version: 3,
          currentStepIndex: 0,
          payload,
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      };
    });

    const { result } = renderSyncHarness(2);

    bumpTitle("self-heal");

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(2);
    });

    const serverPayload = JSON.parse(
      serializeDenaliWizardDraft(formInstance.getValues(), WIZARD_META),
    ) as Record<string, unknown>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(patchMock.mock.calls[0]?.[1]?.version).toBe(2);
    expect(patchMock.mock.calls[1]?.[1]?.version).toBe(3);
    expect(patchMock.mock.calls[1]?.[1]?.payload).toEqual(serverPayload);

    expect(result.current.syncConflict).toBe(false);
    expect(draftVersionRef.current).toBe(4);
  });

  test("syncNow flushes debounce timer and PATCHes immediately", async () => {
    const { result } = renderSyncHarness(2);

    bumpTitle("immediate");

    expect(patchMock).not.toHaveBeenCalled();

    await act(async () => {
      result.current.syncNow();
    });

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(patchMock).toHaveBeenCalledTimes(1);
  });
});
