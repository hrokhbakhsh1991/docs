"use client";

import { useMemo } from "react";

import { aggregateTourTransportMetrics } from "./aggregate-tour-transport-metrics";
import { useTourWorkspace } from "./tour-workspace-context";

export function useTourWorkspaceTransportMetrics() {
  const { registrations, tour, regLoading, regIsError } = useTourWorkspace();

  const metrics = useMemo(
    () => aggregateTourTransportMetrics(registrations, tour.totalCapacity),
    [registrations, tour.totalCapacity],
  );

  return { metrics, isLoading: regLoading, isError: regIsError };
}
