"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageShell,
  useAppLayoutChromeSetter,
} from "@tour/ui";

import { TourForm } from "@/components/tours/TourForm";

import { isLeaderRole, LEADER_WORKSPACE_ACCESS_DENIED, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { tourKeys } from "@/lib/query-keys";
import { getTourById, toursUseLiveApi, updateTour } from "@/lib/services/tours.service";

import { updateTourDtoFromTourFormValues } from "../../tour-ui-mappers";

export function TourEditClient({ tourId }: { tourId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setChrome = useAppLayoutChromeSetter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();
  const leader = isLeaderRole(user?.role);

  const queryEnabled = Boolean(tourId) && liveApi && isHydrated && isAuthenticated && leader;

  const {
    data: tour,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled: queryEnabled,
  });

  const errorMessage =
    error instanceof ApiError
      ? error.status === 404
        ? "No tour was found with this id."
        : error.message
      : "Could not load tour details. Please try again.";

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      dto: ReturnType<typeof updateTourDtoFromTourFormValues>;
      mergeCostFrom: Record<string, unknown> | null | undefined;
    }) =>
      updateTour(tourId, payload.dto, {
        existingCostContext: payload.mergeCostFrom ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
      void queryClient.invalidateQueries({ queryKey: tourKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tourKeys.catalog() });
      router.push(`/tours/${encodeURIComponent(tourId)}`);
    },
  });

  useEffect(() => {
    if (!tour) {
      setChrome(null);
      return;
    }
    setChrome({
      title: "Edit tour",
      description: `Editing ${tour.title} — changes save via PATCH /api/v2/tours/${tourId}.`,
      breadcrumb: (
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Tours", href: "/tours" },
            { label: tour.title },
          ]}
        />
      ),
    });
    return () => setChrome(null);
  }, [tour, tourId, setChrome]);

  if (liveApi && !isHydrated) {
    return (
      <PageShell documentTitle="Edit tour">
        <PageContainer>
          <LoadingState message="Loading session…" />
        </PageContainer>
      </PageShell>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <PageShell documentTitle="Edit tour">
        <PageContainer>
          <EmptyState
            title="Sign in required"
            description="Your session is missing or expired. Sign in to edit tours."
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

  if (liveApi && isHydrated && isAuthenticated && !leader) {
    return (
      <PageShell documentTitle="Edit tour">
        <PageContainer>
          <EmptyState
            title={LEADER_WORKSPACE_ACCESS_DENIED.title}
            description={LEADER_WORKSPACE_ACCESS_DENIED.description}
            action={
              <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}>
                Back to tour
              </Button>
            }
          />
        </PageContainer>
      </PageShell>
    );
  }

  if (isPending) {
    return (
      <PageShell documentTitle="Edit tour">
        <PageContainer>
          <LoadingState message="Loading tour…" />
        </PageContainer>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell documentTitle="Tour not found">
        <PageContainer>
          <ErrorState title="Could not load tour" message={errorMessage} onRetry={() => void refetch()} />
          <p style={{ marginTop: "var(--space-4)", marginBottom: 0, fontSize: "var(--text-small-size)" }}>
            <Link href="/tours" style={{ color: "var(--color-text-link)" }}>
              Back to tours
            </Link>
          </p>
        </PageContainer>
      </PageShell>
    );
  }

  if (!tour) {
    return (
      <PageShell documentTitle="Tour not found">
        <PageContainer>
          <p style={{ marginTop: 0 }} role="alert">
            Tour not found.
          </p>
          <Link href="/tours" style={{ color: "var(--color-text-link)" }}>
            Back to tours
          </Link>
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell documentTitle={`Edit ${tour.title}`}>
      <PageContainer>
        <TourForm
          mode="edit"
          tour={tour}
          onCancel={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
          onSubmit={async (values) => {
            const updated = await updateMutation.mutateAsync({
              dto: updateTourDtoFromTourFormValues(values, tour),
              mergeCostFrom: tour.costContext ?? null,
            });
            if (!updated) {
              throw new Error("Tour not found");
            }
          }}
        />
      </PageContainer>
    </PageShell>
  );
}
