"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isParticipantRole, useAuth } from "@/lib/auth/auth-context";

import { BookingsListView } from "./bookings-list-view";

export function BookingsPageClient() {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated || !user) return;
    if (!isParticipantRole(user.role)) {
      router.replace("/dashboard");
    }
  }, [isHydrated, router, user]);

  if (isHydrated && user && !isParticipantRole(user.role)) {
    return (
      <RegisteredWorkspacePage documentTitle="Bookings" title="Not allowed" breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Bookings" }]}>
        <p>You do not have access to bookings.</p>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle="Bookings"
      title="Bookings"
      description="Your tour registrations from GET /api/v2/bookings."
      breadcrumbItems={[
        { label: "Home", href: "/dashboard" },
        { label: "Bookings" },
      ]}
    >
      <BookingsListView />
    </RegisteredWorkspacePage>
  );
}
