"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Breadcrumb, Button, EmptyState, LoadingState, PageContainer, PageShell, useAppLayoutChromeSetter } from "@tour/ui";

import { TourForm } from "@/components/tours/TourForm";

import { isLeaderRole, LEADER_WORKSPACE_ACCESS_DENIED, useAuth } from "@/lib/auth/auth-context";
import { tourKeys } from "@/lib/query-keys";
import { createTour, toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";

import { createTourDtoFromTourFormValues } from "../tour-ui-mappers";

export function TourCreateClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setChrome = useAppLayoutChromeSetter();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();

  const createMutation = useMutation({
    mutationFn: createTour,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tourKeys.catalog() });
      toast.success({ message: "Tour created successfully." });
      router.push("/tours");
    },
  });

  useEffect(() => {
    setChrome({
      title: "Create tour",
      description: "Creates a tour via POST /api/v2/tours when the API URL is configured.",
      breadcrumb: (
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Tours", href: "/tours" },
            { label: "Create" },
          ]}
        />
      ),
    });
    return () => setChrome(null);
  }, [setChrome]);

  if (liveApi && !isHydrated) {
    return (
      <PageShell documentTitle="Create tour">
        <PageContainer>
          <LoadingState message="Loading session…" />
        </PageContainer>
      </PageShell>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <PageShell documentTitle="Create tour">
        <PageContainer>
          <EmptyState
            title="Sign in required"
            description="Your session is missing or expired. Sign in to create tours."
            action={
              <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                Sign in
              </Button>
            }
          />
        </PageContainer>
      </PageShell>
    );
  }

  if (liveApi && isHydrated && isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <PageShell documentTitle="Create tour">
        <PageContainer>
          <EmptyState
            title={LEADER_WORKSPACE_ACCESS_DENIED.title}
            description={LEADER_WORKSPACE_ACCESS_DENIED.description}
            action={
              <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                Back to tours
              </Button>
            }
          />
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell documentTitle="Create tour">
      <PageContainer>
        <TourForm
          mode="create"
          onCancel={() => router.push("/tours")}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(createTourDtoFromTourFormValues(values));
          }}
        />
      </PageContainer>
    </PageShell>
  );
}
