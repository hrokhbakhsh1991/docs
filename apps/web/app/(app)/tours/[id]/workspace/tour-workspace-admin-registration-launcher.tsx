"use client";

import { useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { AdminAssistedRegistrationDialog } from "@/features/bookings/admin-assisted-registration-dialog";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";

type TourWorkspaceAdminRegistrationLauncherProps = {
  readonly label: string;
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly detail: OperatorTourDetailResponse | null;
  readonly onCreated?: () => void;
};

export function TourWorkspaceAdminRegistrationLauncher({
  label,
  session,
  tourId,
  detail,
  onCreated,
}: TourWorkspaceAdminRegistrationLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="operator-admin-registration-dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <AdminAssistedRegistrationDialog
        open={open}
        onOpenChange={setOpen}
        session={session}
        tourId={tourId}
        detail={detail}
        onCreated={onCreated}
      />
    </>
  );
}
