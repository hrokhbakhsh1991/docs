"use client";

import { WaitlistTable } from "./WaitlistTable";
import { useTourWorkspace } from "./tour-workspace-context";

export function TourWorkspaceWaitlistTab() {
  const {
    readOnly,
    waitlist,
    waitLoading,
    waitIsError,
    refetchWaitlist,
    convertMutation,
  } = useTourWorkspace();

  return (
    <WaitlistTable
      waitlist={waitlist}
      readOnly={readOnly}
      isLoading={waitLoading}
      isError={waitIsError}
      onRetry={() => void refetchWaitlist()}
      convertMutation={convertMutation}
    />
  );
}
