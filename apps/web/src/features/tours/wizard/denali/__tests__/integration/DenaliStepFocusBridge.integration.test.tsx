import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { DenaliNavigationHarness } from "@test-utils/denali-integration-harness";

import { DenaliStepFocusBridge } from "../../DenaliStepFocusBridge";
import { useDenaliWizardNavigation } from "../../DenaliWizardNavigationContext";
import {
  clearDenaliWizardFieldFocus,
  focusDenaliWizardField,
} from "../../denaliWizardFieldFocus";

jest.mock("../../denaliWizardFieldFocus", () => ({
  focusDenaliWizardField: jest.fn(),
  clearDenaliWizardFieldFocus: jest.fn(),
}));

const mockFocusDenaliWizardField = focusDenaliWizardField as jest.MockedFunction<
  typeof focusDenaliWizardField
>;
const mockClearDenaliWizardFieldFocus = clearDenaliWizardFieldFocus as jest.MockedFunction<
  typeof clearDenaliWizardFieldFocus
>;

function NavigationControls({
  stepId,
  formPath,
}: {
  stepId: Parameters<ReturnType<typeof useDenaliWizardNavigation>["navigateToField"]>[0];
  formPath: string;
}) {
  const navigation = useDenaliWizardNavigation();
  return (
    <>
      <button
        type="button"
        data-testid="navigate-to-field"
        onClick={() => navigation.navigateToField(stepId, formPath)}
      >
        navigate
      </button>
      <button
        type="button"
        data-testid="consume-wrong-step"
        onClick={() => navigation.consumePendingFocus("denali_program")}
      >
        consume wrong step
      </button>
      <span data-testid="pending-focus">{navigation.pendingFocusPath ?? "none"}</span>
    </>
  );
}

function FocusBridgeFixture({
  initialStepIndex = 0,
  visibleSteps = getDenaliWizardSteps(),
  mountBridge = true,
}: {
  initialStepIndex?: number;
  visibleSteps?: ReturnType<typeof getDenaliWizardSteps>;
  mountBridge?: boolean;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const activeStepId = visibleSteps[currentStepIndex] ?? visibleSteps[0] ?? "denali_basic";

  return (
    <DenaliNavigationHarness
      visibleSteps={visibleSteps}
      currentStepIndex={currentStepIndex}
      setCurrentStep={setCurrentStepIndex}
    >
      <NavigationControls stepId="denali_logistics" formPath="transport.transportMode" />
      {mountBridge ? <DenaliStepFocusBridge stepId={activeStepId} /> : null}
      <span data-testid="active-step">{activeStepId}</span>
    </DenaliNavigationHarness>
  );
}

function PhotosFocusFixture() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mountBridge, setMountBridge] = useState(false);
  const visibleSteps = getDenaliWizardSteps();
  const activeStepId = visibleSteps[currentStepIndex] ?? "denali_basic";

  return (
    <DenaliNavigationHarness
      visibleSteps={visibleSteps}
      currentStepIndex={currentStepIndex}
      setCurrentStep={setCurrentStepIndex}
    >
      <NavigationControls
        stepId="denali_photos"
        formPath="programNature.shortDescription"
      />
      <button type="button" data-testid="mount-bridge" onClick={() => setMountBridge(true)}>
        mount bridge
      </button>
      {mountBridge ? <DenaliStepFocusBridge stepId={activeStepId} /> : null}
      <span data-testid="active-step">{activeStepId}</span>
    </DenaliNavigationHarness>
  );
}

function runFocusTimers(): void {
  act(() => {
    jest.runAllTimers();
  });
}

describe("DenaliStepFocusBridge", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("cross-step navigation focuses after bridge mounts on target step", () => {
    render(<FocusBridgeFixture initialStepIndex={0} />);
    expect(screen.getByTestId("active-step")).toHaveTextContent("denali_basic");

    fireEvent.click(screen.getByTestId("navigate-to-field"));
    expect(screen.getByTestId("active-step")).toHaveTextContent("denali_logistics");

    runFocusTimers();
    expect(mockFocusDenaliWizardField).toHaveBeenCalledWith("transport.transportMode");
    expect(mockFocusDenaliWizardField).toHaveBeenCalledTimes(1);
  });

  test("same-step navigation focuses immediately without step change", () => {
    const logisticsIndex = getDenaliWizardSteps().indexOf("denali_logistics");
    render(<FocusBridgeFixture initialStepIndex={logisticsIndex} />);

    fireEvent.click(screen.getByTestId("navigate-to-field"));

    runFocusTimers();
    expect(screen.getByTestId("active-step")).toHaveTextContent("denali_logistics");
    expect(mockFocusDenaliWizardField).toHaveBeenCalledWith("transport.transportMode");
  });

  test("consumePendingFocus on wrong step does not focus (no focus jump)", () => {
    render(<PhotosFocusFixture />);

    fireEvent.click(screen.getByTestId("navigate-to-field"));
    expect(screen.getByTestId("pending-focus")).toHaveTextContent("programNature.shortDescription");
    expect(screen.getByTestId("active-step")).toHaveTextContent("denali_photos");

    mockFocusDenaliWizardField.mockClear();
    fireEvent.click(screen.getByTestId("consume-wrong-step"));
    expect(mockFocusDenaliWizardField).not.toHaveBeenCalled();
    expect(screen.getByTestId("pending-focus")).toHaveTextContent("programNature.shortDescription");

    fireEvent.click(screen.getByTestId("mount-bridge"));
    runFocusTimers();
    expect(mockFocusDenaliWizardField).toHaveBeenCalledWith("programNature.shortDescription");
  });

  test("navigateToField no-ops when step is absent from visibleSteps", () => {
    const visibleWithoutLogistics = getDenaliWizardSteps().filter(
      (stepId) => stepId !== "denali_logistics",
    );
    render(<FocusBridgeFixture initialStepIndex={0} visibleSteps={visibleWithoutLogistics} />);

    fireEvent.click(screen.getByTestId("navigate-to-field"));

    expect(screen.getByTestId("active-step")).toHaveTextContent("denali_basic");
    runFocusTimers();
    expect(mockFocusDenaliWizardField).not.toHaveBeenCalled();
    expect(mockClearDenaliWizardFieldFocus).not.toHaveBeenCalled();
  });
});
