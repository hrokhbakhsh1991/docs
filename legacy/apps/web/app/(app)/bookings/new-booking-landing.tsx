"use client";

import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState, LoadingState } from "@tour/ui";
import type { BreadcrumbItem } from "@tour/ui";

const breadcrumbItems: BreadcrumbItem[] = [
  { label: "Home", href: "/dashboard" },
  { label: "Bookings", href: "/bookings" },
  { label: "New registration" },
];

export function NewBookingLanding() {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();
  const liveApi = registrationsUseLiveApi();

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage documentTitle="New registration" title="New registration" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage documentTitle="New registration" title="New registration" breadcrumbItems={breadcrumbItems}>
        <EmptyState
          title="Sign in required"
          description="Sign in to register for a tour."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle="New registration"
      title="Register for a tour"
      description="Choose an open tour, then complete the registration form on its page."
      breadcrumbItems={breadcrumbItems}
      actions={
        <Button type="button" variant="secondary" onClick={() => router.push("/bookings")}>
          All bookings
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardBody style={{ display: "grid", gap: "1rem" }}>
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>Open the tours list.</li>
            <li>Open a tour, then use Register.</li>
            <li>After submitting, track status under Bookings or from the confirmation link.</li>
          </ol>
          <Button type="button" variant="primary" onClick={() => router.push("/tours")}>
            Browse tours
          </Button>
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
