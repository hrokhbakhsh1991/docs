"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  paymentProjectionIsPending,
  registrationNeedsPaymentUi,
  resolvePaymentIntentParamsForBookingCheckout,
} from "@/lib/payment-flow";
import { bookingKeys, registrationKeys, tourKeys } from "@/lib/query-keys";
import { createPaymentIntent } from "@/lib/services/payments.service";
import { getRegistrationById, registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { getTourById, toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";
import { extractTourPriceUsd, formatTourLocation, formatTourPriceUsd } from "@/components/tours/formatters";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  type BreadcrumbItem,
} from "@tour/ui";

import {
  BookingStatusBadgeFa,
  PaymentStatusBadgeFa,
} from "@/components/registrations/registration-status-badges-fa";
import {
  formatRegistrationInstantFa,
  formatTransportModeFa,
} from "@/lib/registrations/format-registration-crm";
import { BOOKING_DETAIL_COPY } from "./booking-detail-copy";
import bookingStyles from "./booking-detail.module.css";
import {
  formatRegistrationEntryMode,
  registrationPollIntervalMs,
} from "./formatters";

export type BookingDetailClientProps = {
  registrationId: string;
  /** From `?checkout=1` — scroll payment card into view after register redirect */
  highlightPaymentCheckout?: boolean;
};

const DEFAULT_PAYMENT_PROVIDER = (
  typeof process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === "string" && process.env.NEXT_PUBLIC_PAYMENT_PROVIDER.trim()
    ? process.env.NEXT_PUBLIC_PAYMENT_PROVIDER.trim()
    : "mock_provider"
).trim();

function detailErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "Registration not found.";
    if (error.status === 403) return "You do not have access to this registration.";
    return error.message.trim() || "Could not load registration.";
  }
  return "Could not load registration.";
}

export function BookingDetailClient({
  registrationId,
  highlightPaymentCheckout = false,
}: BookingDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = registrationsUseLiveApi();
  const registrationEnabled =
    Boolean(registrationId) && liveApi && isHydrated && isAuthenticated;

  const registrationQuery = useQuery({
    queryKey: registrationKeys.detail(registrationId),
    queryFn: () => getRegistrationById(registrationId),
    enabled: registrationEnabled,
    staleTime: 10_000,
    /** Poll while review or payment may change server-side (`RegistrationResponseDto`). */
    refetchInterval: (q) => registrationPollIntervalMs(q.state.data),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const tourId = registrationQuery.data?.tourId?.trim() ?? "";
  const tourQuery = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled:
      Boolean(tourId) &&
      toursUseLiveApi() &&
      isHydrated &&
      isAuthenticated &&
      registrationQuery.isSuccess,
    staleTime: 60_000,
  });

  const paymentIntentMutation = useMutation({
    mutationFn: async () => {
      const regRow = registrationQuery.data;
      if (!regRow) throw new Error("Registration not loaded.");
      const intentParams = resolvePaymentIntentParamsForBookingCheckout(regRow);
      if (!intentParams) {
        throw new Error(
          "Locked booking price missing for payment intent — refresh the page or contact support. For local dev only, set NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_AMOUNT and NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_CURRENCY.",
        );
      }
      return createPaymentIntent({
        registrationId: regRow.id,
        amount: intentParams.amount,
        currency: intentParams.currency,
        paymentProvider: DEFAULT_PAYMENT_PROVIDER,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registrationKeys.detail(registrationId) });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      toast.success({ message: "Payment intent created — status updates shortly." });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === "PAYMENT_PENDING_EXISTS") {
        toast.info({ message: "A pending payment already exists — refreshing registration." });
        void queryClient.invalidateQueries({ queryKey: registrationKeys.detail(registrationId) });
        return;
      }
      const msg =
        error instanceof ApiError
          ? error.message.trim() || "Payment intent failed."
          : "Payment intent failed.";
      toast.error({ message: msg });
    },
  });

  useEffect(() => {
    if (!highlightPaymentCheckout) return;
    const t = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => window.clearTimeout(t);
  }, [highlightPaymentCheckout, registrationQuery.isSuccess]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/dashboard" },
    { label: "Bookings", href: "/bookings" },
    { label: "Registration details" },
  ];

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage documentTitle="Registration details" title="Registration" breadcrumbItems={breadcrumbItems}>
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
      <RegisteredWorkspacePage documentTitle="Registration details" title="Registration" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <EmptyState
              title="Sign in required"
              description="Sign in to view this registration."
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (registrationQuery.isPending) {
    return (
      <RegisteredWorkspacePage documentTitle="Registration details" title="Registration" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <LoadingState message="Loading registration…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (registrationQuery.isError) {
    return (
      <RegisteredWorkspacePage documentTitle="Registration details" title="Registration" breadcrumbItems={breadcrumbItems}>
        <Card>
          <CardBody>
            <ErrorState
              title="Could not load registration"
              message={detailErrorMessage(registrationQuery.error)}
              onRetry={() => void registrationQuery.refetch()}
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  const reg = registrationQuery.data!;
  const pollMs = registrationPollIntervalMs(reg);
  const pollSubtitle =
    pollMs === false
      ? "Open Refresh if you are waiting for an update."
      : `Watching for updates from the server (${Math.round(pollMs / 1000)} s).`;

  const paymentSnapshot =
    reg.payment && typeof reg.payment === "object" ? reg.payment : null;
  const paymentSnapshotRecord = paymentSnapshot as Record<string, unknown> | null;
  const tour = tourQuery.data;
  const lockedPricing = reg.lockedPricing;
  const tourPrice = tour ? extractTourPriceUsd(tour.costContext ?? null) : 0;
  const paymentEligible = registrationNeedsPaymentUi({
    status: reg.status,
    paymentStatus: reg.paymentStatus,
    tour,
    lockedPricing: reg.lockedPricing,
  });
  const hasPendingPaymentProjection = paymentProjectionIsPending(paymentSnapshotRecord);
  const intentParams = resolvePaymentIntentParamsForBookingCheckout(reg);
  const showStartIntentCta =
    paymentEligible && !hasPendingPaymentProjection && Boolean(intentParams);
  const isPendingHostReview = reg.status === "Pending";
  const pendingCopy = BOOKING_DETAIL_COPY.pendingHostReview;

  /** FR-61 (MVP): only leaders resolve the URL; non-leaders never get a trimmed href (no DOM exposure). */
  const leaderCommunicationHref =
    isLeaderRole(user?.role) &&
    tour?.communicationLink != null &&
    String(tour.communicationLink).trim() !== ""
      ? String(tour.communicationLink).trim()
      : null;

  return (
    <RegisteredWorkspacePage
      documentTitle={`Registration · ${reg.id.slice(0, 8)}…`}
      title="Registration details"
      description={pollSubtitle}
      breadcrumbItems={breadcrumbItems}
      actions={
        <Button
          type="button"
          variant="secondary"
          disabled={registrationQuery.isFetching}
          onClick={() => {
            void registrationQuery.refetch();
            if (tourId) void tourQuery.refetch();
            void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
          }}
        >
          {registrationQuery.isFetching ? "Refreshing…" : "Refresh now"}
        </Button>
      }
    >
      <div className={bookingStyles.rtlRoot} dir="rtl">
        {isPendingHostReview ? (
          <Alert
            variant="warning"
            title={pendingCopy.bannerTitle}
            className={bookingStyles.pendingBanner}
            role="status"
          >
            {pendingCopy.bannerBody}
          </Alert>
        ) : null}

      <Card>
        <CardHeader>
          <CardTitle>وضعیت ثبت‌نام</CardTitle>
        </CardHeader>
        <CardBody style={{ display: "grid", gap: "1rem" }}>
          <div className={bookingStyles.statusRow}>
            {isPendingHostReview ? (
              <span className={bookingStyles.pendingHostBadge}>{pendingCopy.statusBadge}</span>
            ) : (
              <BookingStatusBadgeFa status={reg.status} />
            )}
            {!isPendingHostReview ? <PaymentStatusBadgeFa payment={reg.paymentStatus} /> : null}
          </div>
          <dl style={{ margin: 0, display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <dt style={{ fontWeight: 600 }}>ثبت شده</dt>
              <dd style={{ margin: 0 }}>{formatRegistrationInstantFa(reg.createdAt)}</dd>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <dt style={{ fontWeight: 600 }}>آخرین بروزرسانی</dt>
              <dd style={{ margin: 0 }}>{formatRegistrationInstantFa(reg.updatedAt)}</dd>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <dt style={{ fontWeight: 600 }}>شناسه ثبت‌نام</dt>
              <dd style={{ margin: 0, fontFamily: "ui-monospace, monospace" }}>{reg.id}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {leaderCommunicationHref ? (
        <Card>
          <CardHeader>
            <CardTitle dir="rtl">ارتباط با رهبر تور</CardTitle>
          </CardHeader>
          <CardBody>
            <a
              href={leaderCommunicationHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-text-link)",
                wordBreak: "break-word",
                fontSize: "0.95rem",
              }}
            >
              {leaderCommunicationHref}
            </a>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tour</CardTitle>
        </CardHeader>
        <CardBody>
          {tourQuery.isPending ? (
            <LoadingState message="Loading tour…" />
          ) : tourQuery.isError ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <Alert variant="warning" title="Could not load tour">
                {(tourQuery.error instanceof ApiError && tourQuery.error.message.trim()) ||
                  "Tour details failed to load. You can still open the tour link below."}
              </Alert>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                <Button type="button" variant="secondary" onClick={() => void tourQuery.refetch()}>
                  Retry
                </Button>
                <Link href={`/tours/${reg.tourId}`} style={{ fontSize: "0.9rem" }}>
                  Open tour →
                </Link>
              </div>
            </div>
          ) : !tour ? (
            <p style={{ margin: 0 }}>
              Tour <span style={{ fontFamily: "ui-monospace, monospace" }}>{reg.tourId}</span> was not found.{" "}
              <Link href={`/tours/${reg.tourId}`}>Try tour page →</Link>
            </p>
          ) : (
            <>
              <p style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.1rem", fontWeight: 600 }}>
                <Link href={`/tours/${tour.id}`}>{tour.title}</Link>
              </p>
              <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
                <div>
                  <dt style={{ fontWeight: 600 }}>Location</dt>
                  <dd style={{ margin: 0 }}>{formatTourLocation(tour)}</dd>
                </div>
                <div>
                  <dt style={{ fontWeight: 600 }}>Capacity</dt>
                  <dd style={{ margin: 0 }}>
                    {tour.acceptedCount} accepted / {tour.totalCapacity} total
                  </dd>
                </div>
                {lockedPricing?.totalMinor && lockedPricing.currency ? (
                  <div>
                    <dt style={{ fontWeight: 600 }}>Your booked price</dt>
                    <dd style={{ margin: 0 }}>
                      {lockedPricing.totalMinor} {lockedPricing.currency} (minor units, locked at booking)
                    </dd>
                  </div>
                ) : tourPrice > 0 ? (
                  <div>
                    <dt style={{ fontWeight: 600 }}>Price</dt>
                    <dd style={{ margin: 0 }}>{formatTourPriceUsd(tourPrice)}</dd>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant</CardTitle>
        </CardHeader>
        <CardBody>
          <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
            <div>
              <dt style={{ fontWeight: 600 }}>Name</dt>
              <dd style={{ margin: 0 }}>{reg.participantFullName}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Phone</dt>
              <dd style={{ margin: 0 }}>{reg.participantContactPhone}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>وسیله نقلیه</dt>
              <dd style={{ margin: 0 }}>{formatTransportModeFa(reg.transportMode)}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 600 }}>Channel</dt>
              <dd style={{ margin: 0 }}>{formatRegistrationEntryMode(reg.entryMode)}</dd>
            </div>
            {typeof reg.vehicleSeatCapacity === "number" ? (
              <div>
                <dt style={{ fontWeight: 600 }}>Vehicle seats</dt>
                <dd style={{ margin: 0 }}>{reg.vehicleSeatCapacity}</dd>
              </div>
            ) : null}
            {reg.participantNote ? (
              <div>
                <dt style={{ fontWeight: 600 }}>Note</dt>
                <dd style={{ margin: 0 }}>{reg.participantNote}</dd>
              </div>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      <div ref={paymentSectionRef}>
      <Card>
        <CardHeader>
          <CardTitle>پرداخت</CardTitle>
        </CardHeader>
        <CardBody>
          {isPendingHostReview ? (
            <p className={bookingStyles.paymentLockedNote}>{pendingCopy.paymentLocked}</p>
          ) : (
            <>
          <p style={{ marginTop: 0 }}>
            وضعیت: <strong>{reg.paymentStatus}</strong>
            {reg.paidAmount != null && String(reg.paidAmount).trim() !== ""
              ? ` · مبلغ پرداخت‌شده: ${reg.paidAmount}`
              : null}
          </p>
          {paymentEligible && hasPendingPaymentProjection ? (
            <div style={{ marginBottom: "1rem" }}>
              <Alert variant="warning" title="Payment pending">
                A checkout intent exists with status <strong>Pending</strong>. Settlement is asynchronous — leave this page
                open or refresh periodically; polling runs automatically while payment is unresolved.
              </Alert>
            </div>
          ) : null}
          {paymentEligible && !hasPendingPaymentProjection ? (
            <div style={{ marginBottom: "1rem" }}>
              <Alert variant="info" title="Payment required">
                Complete payment to confirm your <strong>Accepted</strong> seat. Creating an intent records a PSP row;
                webhook completion updates the registration aggregate — this screen keeps polling registration detail until
                status settles.
              </Alert>
              {showStartIntentCta ? (
                <Button
                  type="button"
                  variant="primary"
                  style={{ marginTop: "0.75rem" }}
                  disabled={paymentIntentMutation.isPending}
                  onClick={() => void paymentIntentMutation.mutate()}
                  data-testid="payment-intent-submit"
                >
                  {paymentIntentMutation.isPending ? "Creating intent…" : "Start payment (intent)"}
                </Button>
              ) : null}
              {paymentEligible && !intentParams && !tourQuery.isPending ? (
                <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.85 }}>
                  Set <code>totalCost</code> + <code>currency</code> on the tour, or configure{" "}
                  <code>NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_AMOUNT</code> and{" "}
                  <code>NEXT_PUBLIC_PAYMENT_INTENT_FALLBACK_CURRENCY</code> for local intents.
                </p>
              ) : null}
            </div>
          ) : null}
          {paymentSnapshot ? (
            <pre
              style={{
                marginTop: "0.75rem",
                padding: "1rem",
                overflow: "auto",
                fontSize: "0.85rem",
                borderRadius: 8,
                background: "var(--color-surface-muted, #f6f6f6)",
              }}
            >
              {JSON.stringify(paymentSnapshot, null, 2)}
            </pre>
          ) : (
            <p style={{ opacity: 0.8 }}>No payment snapshot yet.</p>
          )}
            </>
          )}
        </CardBody>
      </Card>
      </div>

      <Card>
        <CardBody>
          <Button type="button" variant="secondary" onClick={() => router.push("/bookings")}>
            All bookings
          </Button>
        </CardBody>
      </Card>
      </div>
    </RegisteredWorkspacePage>
  );
}
