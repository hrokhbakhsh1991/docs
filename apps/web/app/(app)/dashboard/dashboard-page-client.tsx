"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { useLeaderTourRegistrations } from "@/lib/hooks/useLeaderTourRegistrations";
import { tourKeys } from "@/lib/query-keys";
import { getTours, toursUseLiveApi } from "@/lib/services/tours.service";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardSubtitle,
  CardTitle,
  EmptyState,
  LoadingState
} from "@tour/ui";

import styles from "./dashboard.module.css";

export function DashboardPageClient() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const enabled = liveApi && isHydrated && isAuthenticated;

  const toursQuery = useQuery({
    queryKey: tourKeys.list({ search: "" }),
    queryFn: () => getTours({ search: "" }),
    enabled,
  });

  const leaderIndex = useLeaderTourRegistrations(leader && enabled);

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
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
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card>
          <CardBody>
            <EmptyState
              title="Sign in required"
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

  if (isHydrated && isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card>
          <CardBody>
            <p dir="rtl" className={styles.bodyText}>
              شما دسترسی رهبر ندارید.
            </p>
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  const tourTotal = toursQuery.data?.total ?? toursQuery.data?.tours?.length ?? 0;

  return (
    <RegisteredWorkspacePage
      documentTitle="Dashboard"
      title="Leader dashboard"
      description="Pending registrations, per-tour workspace, payment updates — all wired to documented /api/v2 routes."
      breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
    >
      <ul className={styles.grid}>
        <li className={styles.gridItem}>
          <Card className={styles.gridCard}>
            <CardHeader>
              <CardTitle>Tours</CardTitle>
              <CardSubtitle>Tenant-scoped catalogue (J‑L‑01).</CardSubtitle>
            </CardHeader>
            <CardBody className={styles.cardBody}>
              <p className={styles.metricRow}>
                Loaded tours:{" "}
                <Badge variant={toursQuery.isPending ? "neutral" : "info"}>{toursQuery.isPending ? "…" : tourTotal}</Badge>
              </p>
            </CardBody>
            <CardFooter>
              <Button type="button" variant="primary" onClick={() => router.push("/tours")}>
                Manage tours
              </Button>
            </CardFooter>
          </Card>
        </li>
        <li className={styles.gridItem}>
          <Card className={styles.gridCard}>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
              <CardSubtitle>Your registrations and payment summaries (J‑P‑02, J‑P‑03).</CardSubtitle>
            </CardHeader>
            <CardBody className={styles.cardBody}>
              <div className={styles.bodySpacer} aria-hidden />
            </CardBody>
            <CardFooter>
              <Button type="button" variant="secondary" onClick={() => router.push("/bookings")}>
                View bookings
              </Button>
            </CardFooter>
          </Card>
        </li>
        <li className={styles.gridItem}>
          <Card className={styles.gridCard}>
            <CardHeader>
              <CardTitle>Payments & reconciliation</CardTitle>
              <CardSubtitle>
                Payment fields on each registration are updated via{" "}
                <strong>PATCH /api/v2/registrations/{"{id}"}/payment</strong> — use a tour workspace or the review
                queue.
              </CardSubtitle>
            </CardHeader>
            <CardBody className={styles.cardBody}>
              <p className={styles.bodyText}>
                Cross-tour CSV is generated in <strong>Review queue</strong> from live registrations (there is no{" "}
                <code>/reconciliation/export.csv</code> route in OpenAPI yet).
              </p>
            </CardBody>
            <CardFooter>
              <span className={styles.footerSpacer} aria-hidden />
            </CardFooter>
          </Card>
        </li>
        <li className={styles.gridItem}>
          <Card className={styles.gridCard}>
            <CardHeader>
              <CardTitle>Registration review queue</CardTitle>
              <CardSubtitle>Pulled from every tour listing your session can fetch as leader.</CardSubtitle>
            </CardHeader>
            <CardBody className={styles.cardBody}>
              <p className={styles.metricRow}>
                Pending registrations:{" "}
                <Badge variant={leaderIndex.isLoading ? "neutral" : "warning"}>
                  {leaderIndex.isLoading ? "…" : leaderIndex.pendingCount}
                </Badge>{" "}
                · Rows loaded:{" "}
                <Badge variant={leaderIndex.isLoading ? "neutral" : "info"}>
                  {leaderIndex.isLoading ? "…" : leaderIndex.totalRegistrationCount}
                </Badge>
              </p>
            </CardBody>
            <CardFooter>
              <Button type="button" variant="primary" onClick={() => router.push("/leader/review")}>
                Open review queue
              </Button>
              <Button type="button" variant="secondary" onClick={() => void leaderIndex.refetchAll()}>
                Refresh counts
              </Button>
              <Link href="/tours" className={styles.inlineLink}>
                Manage tours →
              </Link>
            </CardFooter>
          </Card>
        </li>
      </ul>
      <Card className={styles.usersCard}>
        <CardHeader>
          <CardTitle>Workspace users directory:</CardTitle>
          <CardSubtitle>
            Workspace users directory:{" "}
            <Link href="/users" className={styles.inlineLink}>
              Users
            </Link>
          </CardSubtitle>
        </CardHeader>
        <CardBody>
          <div className={styles.bodySpacer} aria-hidden />
        </CardBody>
        <CardFooter>
          <span className={styles.footerSpacer} aria-hidden />
        </CardFooter>
      </Card>
    </RegisteredWorkspacePage>
  );
}
