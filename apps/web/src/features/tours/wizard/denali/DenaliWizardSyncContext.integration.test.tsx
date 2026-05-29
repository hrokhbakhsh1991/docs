import React, { useEffect, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { type UseFormReturn } from "react-hook-form";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSteps, type DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import { DenaliFormHarness } from "@test-utils/denali-integration-harness";

import { DenaliStepFocusBridge } from "./DenaliStepFocusBridge";
import { useDenaliCanonical } from "./DenaliCanonicalContext";
import { DenaliWizardNavigationProvider, useDenaliWizardNavigation } from "./DenaliWizardNavigationContext";
import { DenaliWizardSyncProvider } from "./DenaliWizardSyncContext";
import { useDenaliCanonicalModel } from "./hooks/useDenaliCanonicalModel";

let originalGetClientRects: (() => DOMRectList) | null = null;

jest.mock("@/components/shared/quick-add/QuickAddModal.module.css", () => ({}));

jest.mock("@tour/ui", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Checkbox: ({
    checked,
    onChange,
    label,
    ...rest
  }: {
    checked?: boolean;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    label?: string;
  }) => (
    <label>
      <input type="checkbox" checked={checked} onChange={onChange} {...rest} />
      {label ?? null}
    </label>
  ),
  FormField: ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <label>
      {label ?? null}
      {children}
    </label>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

jest.mock("@/hooks/use-tour-destinations", () => ({
  useTourDestinations: () => ({
    destinations: [],
    groupedRegions: [],
  }),
}));

jest.mock("@/hooks/use-workspace-tour-crew-members", () => ({
  useWorkspaceTourCrewMembers: () => ({ data: [] }),
}));

jest.mock("./hooks/useDenaliDestinationQuickAdd", () => ({
  useDenaliDestinationQuickAdd: () => () => undefined,
}));

jest.mock("./hooks/useDenaliEquipmentQuickAdd", () => ({
  useDenaliEquipmentQuickAdd: () => () => undefined,
}));

function StepBody({ stepId }: { stepId: DenaliCreateWizardStepId }) {
  if (stepId === "denali_basic") return <AuditBasicsStep />;
  if (stepId === "denali_program") return <AuditProgramStep />;
  if (stepId === "denali_logistics") {
    return (
      <div data-testid="denali-step-logistics">
        <select data-testid="denali-transport-mode" data-field-path="transport.transportMode">
          <option value="bus">bus</option>
        </select>
        <input data-testid="denali-logistics-fallback-input" />
      </div>
    );
  }
  return <div data-testid={`denali-step-${stepId}`} />;
}

function AuditBasicsStep() {
  const { basicsSelection, updateCanonicalBasics } = useDenaliCanonical();
  return (
    <div data-testid="denali-step-basics">
      <select
        data-testid="denali-basics-category"
        value={basicsSelection.category}
        onChange={(e) =>
          updateCanonicalBasics({
            category: e.target.value as "mountain" | "event",
          })
        }
      >
        <option value="mountain">mountain</option>
        <option value="event">event</option>
      </select>
    </div>
  );
}

function AuditProgramStep() {
  const { basicsSelection, updateCanonical } = useDenaliCanonical();
  const isMountain = basicsSelection.category === "mountain";
  return (
    <div data-testid="denali-step-program">
      {isMountain ? (
        <>
          <input
            data-testid="denali-program-difficulty-slider"
            type="range"
            min={1}
            max={10}
            onChange={(e) =>
              updateCanonical({
                program: { difficultyLevel: Number(e.target.value) },
              })
            }
          />
          <input
            data-testid="denali-program-hiking-hours"
            onChange={(e) =>
              updateCanonical({
                program: {
                  hikingHoursApprox: e.target.value === "" ? undefined : Number(e.target.value),
                },
              })
            }
          />
        </>
      ) : null}
    </div>
  );
}

function CanonicalProbe({
  onCanonicalChange,
}: {
  onCanonicalChange: (_next: ReturnType<typeof useDenaliCanonicalModel>) => void;
}) {
  const canonical = useDenaliCanonicalModel();
  useEffect(() => {
    onCanonicalChange(canonical);
  }, [canonical, onCanonicalChange]);
  return null;
}

function SyncContextFixture({
  defaultValues,
  initialStep = "denali_program",
  onCanonicalChange,
}: {
  defaultValues: DenaliCreateTourWizardForm;
  initialStep?: DenaliCreateWizardStepId;
  onCanonicalChange: (_next: ReturnType<typeof useDenaliCanonicalModel>) => void;
}) {
  const visibleSteps = getDenaliWizardSteps();
  const [currentStepIndex, setCurrentStepIndex] = useState(
    Math.max(visibleSteps.indexOf(initialStep), 0),
  );
  const activeStepId = visibleSteps[currentStepIndex] ?? "denali_basic";

  return (
    <DenaliFormHarness defaultValues={defaultValues}>
      {({ formMethods }) => (
        <DenaliWizardSyncProvider isSyncing={false}>
          <DenaliWizardNavigationProvider
            visibleSteps={visibleSteps}
            currentStepIndex={currentStepIndex}
            setCurrentStep={setCurrentStepIndex}
          >
            <CanonicalProbe onCanonicalChange={onCanonicalChange} />
            <SyncContextControls setCurrentStepIndex={setCurrentStepIndex} formMethods={formMethods} />
            <DenaliStepFocusBridge stepId={activeStepId} />
            <StepBody stepId={activeStepId} />
          </DenaliWizardNavigationProvider>
        </DenaliWizardSyncProvider>
      )}
    </DenaliFormHarness>
  );
}

function SyncContextControls({
  setCurrentStepIndex,
  formMethods,
}: {
  setCurrentStepIndex: (_updater: (_prev: number) => number) => void;
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
}) {
  const navigation = useDenaliWizardNavigation();
  const steps = getDenaliWizardSteps();
  const stepIndex = (stepId: DenaliCreateWizardStepId) => Math.max(steps.indexOf(stepId), 0);
  return (
    <div>
      <button
        type="button"
        data-testid="go-program"
        onClick={() => setCurrentStepIndex(() => stepIndex("denali_program"))}
      >
        go program
      </button>
      <button
        type="button"
        data-testid="go-basics"
        onClick={() => setCurrentStepIndex(() => stepIndex("denali_basic"))}
      >
        go basics
      </button>
      <button
        type="button"
        data-testid="go-logistics"
        onClick={() => setCurrentStepIndex(() => stepIndex("denali_logistics"))}
      >
        go logistics
      </button>
      <button
        type="button"
        data-testid="go-logistics-broken-focus"
        onClick={() => navigation.navigateToField("denali_logistics", "transport.nonExistentPath")}
      >
        go logistics broken focus
      </button>
      <button
        type="button"
        data-testid="mark-dirty"
        onClick={() =>
          formMethods.setValue("basicInfo.title", "integration-audit", {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          })
        }
      >
        mark dirty
      </button>
    </div>
  );
}

function canonicalDump(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

describe("DenaliWizardIntegrationAudit", () => {
  beforeEach(() => {
    jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    originalGetClientRects = HTMLElement.prototype.getClientRects;
    Object.defineProperty(HTMLElement.prototype, "getClientRects", {
      configurable: true,
      value: function getClientRectsMock() {
        return [{ width: 100, height: 20 }] as unknown as DOMRectList;
      },
    });
  });

  afterEach(() => {
    if (originalGetClientRects) {
      Object.defineProperty(HTMLElement.prototype, "getClientRects", {
        configurable: true,
        value: originalGetClientRects,
      });
      originalGetClientRects = null;
    }
    jest.restoreAllMocks();
  });

  test("Scenario 1: kind switch purges ghost fields from CanonicalContext", async () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.tourType = "mountain_day";
    let latestCanonical: unknown = null;

    render(
      <SyncContextFixture
        defaultValues={form}
        initialStep="denali_program"
        onCanonicalChange={(next) => {
          latestCanonical = next;
        }}
      />,
    );

    screen.getByTestId("denali-program-difficulty-slider");
    const hikingHours = screen.getByTestId("denali-program-hiking-hours");
    fireEvent.change(hikingHours, { target: { value: "12" } });
    fireEvent.click(screen.getByTestId("mark-dirty"));
    fireEvent.click(screen.getByTestId("go-basics"));

    fireEvent.change(screen.getByTestId("denali-basics-category"), {
      target: { value: "event" },
    });
    fireEvent.click(screen.getByTestId("go-program"));

    expect(screen.queryByTestId("denali-program-difficulty-slider")).toBeNull();
    expect(screen.queryByTestId("denali-program-hiking-hours")).toBeNull();

    const canonical = latestCanonical as {
      program?: { difficultyLevel?: unknown; hikingHoursApprox?: unknown };
      participants?: { minimumAge?: unknown };
    } | null;
    if (!canonical) {
      throw new Error("CanonicalContext is null after kind switch.");
    }
    if (canonical.program?.difficultyLevel !== undefined) {
      throw new Error(
        `difficultyLevel should be purged after kind switch.\nCanonicalContext:\n${canonicalDump(canonical)}`,
      );
    }
    if (canonical.program?.hikingHoursApprox !== undefined) {
      throw new Error(
        `hikingHoursApprox should be purged after kind switch.\nCanonicalContext:\n${canonicalDump(canonical)}`,
      );
    }
    if (canonical.participants?.minimumAge !== undefined) {
      throw new Error(
        `minimumAge should be purged after kind switch.\nCanonicalContext:\n${canonicalDump(canonical)}`,
      );
    }
  });

  test("Scenario 2: focus fallback targets first interactable field when mapping path is broken", async () => {
    jest.useFakeTimers();
    try {
      const form = buildDenaliTourCreateDefaultValues();
      form.basicInfo.tourType = "mountain_day";

      render(<SyncContextFixture defaultValues={form} initialStep="denali_basic" onCanonicalChange={() => undefined} />);

      // Keyboard-only: tab until the broken-focus navigation control, then press Enter.
      const trigger = screen.getByTestId("go-logistics-broken-focus");
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
      fireEvent.click(trigger);

      await screen.findByTestId("denali-step-logistics");

      // Flush bridge timers + RAF fallback window.
      act(() => {
        jest.runOnlyPendingTimers();
        jest.advanceTimersByTime(120);
      });

      const logisticsStep = screen.getByTestId("denali-step-logistics");
      const firstField = within(logisticsStep).getByTestId("denali-transport-mode");
      expect(firstField).toBe(document.activeElement);
    } finally {
      jest.useRealTimers();
    }
  });
});
