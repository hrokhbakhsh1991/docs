"use client";

import { useState } from "react";

import { RegistrationsTable } from "./RegistrationsTable";
import { useTourWorkspace } from "./tour-workspace-context";

export function TourWorkspaceRegistrationsTab() {
  const {
    readOnly,
    registrations,
    regLoading,
    regIsError,
    refetchRegistrations,
    statusMutation,
    paymentMutation,
  } = useTourWorkspace();

  const [registrationListFilter, setRegistrationListFilter] = useState<"all" | "pending">("all");

  return (
    <RegistrationsTable
      registrations={registrations}
      filter={registrationListFilter}
      onFilterChange={setRegistrationListFilter}
      readOnly={readOnly}
      isLoading={regLoading}
      isError={regIsError}
      onRetry={() => void refetchRegistrations()}
      statusMutation={statusMutation}
      paymentMutation={paymentMutation}
    />
  );
}
