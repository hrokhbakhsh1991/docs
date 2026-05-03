"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  FormField,
  Input,
  Select,
  Textarea,
} from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { registrationNeedsPaymentUi } from "@/lib/payment-flow";
import { bookingKeys, registrationKeys, tourKeys } from "@/lib/query-keys";
import { publicRegisterTour, registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { getTourById, toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";

const IntakeSchema = z.object({
  participantFullName: z.string().trim().min(1, "Full name is required.").max(255),
  participantContactPhone: z.string().trim().min(1, "Phone is required.").max(64),
  transportMode: z.enum(["self_vehicle", "group_vehicle", "other"]),
  participantNote: z.string().trim().max(2000).optional(),
  vehicleSeatCapacity: z.string().trim().refine(
    (s) => !s.length || (/^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 99),
    { message: "Between 1 and 99 seats, or leave blank." },
  ),
});

type IntakeValues = z.infer<typeof IntakeSchema>;

function registerTourErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not complete registration. Please try again.";
  }
  if (error.code === "REGISTRATION_DUPLICATE_ACTIVE") {
    return "You already have an active registration for this tour.";
  }
  return error.message.trim() || "Could not complete registration. Please try again.";
}

const breadcrumbTrail = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tours", href: "/tours" },
  { label: "Register" },
] as const;

export type RegisterForTourClientProps = {
  tourId: string;
};

export function RegisterForTourClient({ tourId }: RegisterForTourClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi() && registrationsUseLiveApi();
  const tourQueryEnabled = Boolean(tourId) && toursUseLiveApi() && isHydrated && isAuthenticated;

  const { data: tour, isPending: tourLoading } = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled: tourQueryEnabled,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IntakeValues>({
    resolver: zodResolver(IntakeSchema),
    defaultValues: {
      participantFullName: "",
      participantContactPhone: "",
      transportMode: "group_vehicle",
      participantNote: "",
      vehicleSeatCapacity: "",
    },
  });

  const placementMutation = useMutation({
    mutationFn: async (values: IntakeValues) => {
      const tenantId = user?.tenantId?.trim();
      if (!tenantId) throw new Error("Missing tenant.");
      return publicRegisterTour(tourId, {
        tenantId,
        tourId,
        participantFullName: values.participantFullName.trim(),
        participantContactPhone: values.participantContactPhone.trim(),
        transportMode: values.transportMode,
        entryMode: "web",
        participantNote: values.participantNote?.trim() || undefined,
        vehicleSeatCapacity: (() => {
          const raw = values.vehicleSeatCapacity?.trim();
          if (!raw?.length) return undefined;
          const n = Number(raw);
          return Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined;
        })(),
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: registrationKeys.tourWaitlist(tourId) });
      void queryClient.invalidateQueries({ queryKey: registrationKeys.tourRegistrations(tourId) });
      void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
      if (data.outcome === "registered") {
        void queryClient.invalidateQueries({ queryKey: registrationKeys.detail(data.booking.id) });
        toast.success({ message: "Registration submitted." });
      } else {
        toast.success({
          message: `You are on the waitlist (position ${data.queuePosition}).`,
        });
      }
    },
    onError: (error: unknown) => {
      toast.error({ message: registerTourErrorMessage(error) });
    },
  });

  useEffect(() => {
    placementMutation.reset();
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, reset]);

  const title = tour?.title ?? "Register for tour";
  const placement = placementMutation.data;
  const lastRegId = placement?.outcome === "registered" ? placement.booking.id : undefined;
  const owesPaymentAfterRegister =
    placement?.outcome === "registered"
      ? registrationNeedsPaymentUi({
          status: placement.booking.status,
          paymentStatus: placement.booking.paymentStatus,
          tour,
        })
      : false;

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card>
          <CardBody>Loading session…</CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Sign in required"
          description="Sign in to complete the registration intake."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (toursUseLiveApi() && tourLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card>
          <CardBody>Loading tour…</CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={title}
      title={title}
      description={tour?.title ? `Tour: ${tour.title}` : undefined}
      breadcrumbItems={[...breadcrumbTrail]}
      actions={null}
    >
      <Card>
        <CardBody>
          {placementMutation.isSuccess && lastRegId ? (
            <div data-testid="register-success">
              <p role="status">Your registration was created.</p>
              {placement?.outcome === "registered" && placement.paymentIntent ? (
                <p style={{ marginTop: "0.75rem" }}>
                  Payment record started — status{" "}
                  <strong>{placement.paymentIntent.status}</strong> ({placement.paymentIntent.currency}{" "}
                  {placement.paymentIntent.amount}). Open details to monitor settlement.
                </p>
              ) : null}
              {placement?.outcome === "registered" && owesPaymentAfterRegister && !placement.paymentIntent ? (
                <p style={{ marginTop: "0.75rem" }}>
                  Next step: create a checkout intent from your registration detail (payment confirms your seat asynchronously).
                </p>
              ) : null}
              <p style={{ marginTop: "0.75rem" }}>
                Registration ID: <strong>{lastRegId}</strong>
              </p>
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    router.push(`/bookings/${lastRegId}${owesPaymentAfterRegister ? "?checkout=1" : ""}`)
                  }
                >
                  {owesPaymentAfterRegister ? "Open registration & pay" : "Track status"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}`)}>
                  Back to tour
                </Button>
              </div>
            </div>
          ) : placementMutation.isSuccess && placement?.outcome === "waitlisted" ? (
            <div data-testid="register-success" role="status">
              <p>You are on the waitlist for this tour.</p>
              <p style={{ marginTop: "0.5rem" }}>
                Queue position: <strong>{placement.queuePosition}</strong>
              </p>
              <Link href={`/tours/${tourId}`} style={{ display: "inline-block", marginTop: "1rem" }}>
                Return to tour
              </Link>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={handleSubmit((values) => {
                void placementMutation.mutateAsync(values);
              })}
            >
              <p style={{ marginBottom: "1rem" }}>
                Complete the intake form. Placement uses{" "}
                <strong>
                  POST /api/v2/tours/
                  {"{"}tourId{"}"}/register
                </strong>{" "}
                (capacity-aware — full tours are waitlisted in the same response).
              </p>
              <FormField label="Full name" required error={errors.participantFullName?.message}>
                <Input autoComplete="name" {...register("participantFullName")} />
              </FormField>
              <FormField label="Contact phone" required error={errors.participantContactPhone?.message}>
                <Input autoComplete="tel" {...register("participantContactPhone")} />
              </FormField>
              <FormField label="Transport mode" required error={errors.transportMode?.message}>
                <Select aria-label="Transport mode" {...register("transportMode")}>
                  <option value="self_vehicle">Self vehicle</option>
                  <option value="group_vehicle">Group vehicle</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>
              <FormField label="Vehicle seats (optional)" error={errors.vehicleSeatCapacity?.message}>
                <Input inputMode="numeric" placeholder="e.g. 4" {...register("vehicleSeatCapacity")} />
              </FormField>
              <FormField label="Notes (optional)" error={errors.participantNote?.message}>
                <Textarea rows={3} {...register("participantNote")} />
              </FormField>
              <div style={{ marginTop: "1rem" }}>
                <Button type="submit" variant="primary" disabled={isSubmitting || placementMutation.isPending}>
                  {placementMutation.isPending ? "Submitting…" : "Submit registration"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
