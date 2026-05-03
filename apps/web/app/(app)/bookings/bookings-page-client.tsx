"use client";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { BookingsListView } from "./bookings-list-view";

export function BookingsPageClient() {
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
