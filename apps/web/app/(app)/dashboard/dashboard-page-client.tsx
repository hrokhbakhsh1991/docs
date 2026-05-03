"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { useLeaderTourRegistrations } from "@/lib/hooks/useLeaderTourRegistrations";
import { tourKeys } from "@/lib/query-keys";
import { getTours, toursUseLiveApi } from "@/lib/services/tours.service";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, LoadingState } from "@tour/ui";

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

  const tourTotal = toursQuery.data?.total ?? toursQuery.data?.tours?.length ?? 0;

  return (
    <RegisteredWorkspacePage
      documentTitle="Dashboard"
      title={leader ? "Leader dashboard" : "Workspace overview"}
      description={
        leader
          ? "Pending registrations, per-tour workspace, payment updates — all wired to documented /api/v2 routes."
          : "Your tenant workspace: tours, bookings, settings."
      }
      breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
    >
      <ul className={styles.grid}>
        <li>
          <Card>
            <CardHeader>
              <CardTitle>Tours</CardTitle>
            </CardHeader>
            <CardBody>
              <p>Tenant-scoped catalogue (J‑L‑01).</p>
              <p style={{ marginTop: "0.5rem" }}>
                Loaded tours:{" "}
                <Badge variant={toursQuery.isPending ? "neutral" : "info"}>{toursQuery.isPending ? "…" : tourTotal}</Badge>
              </p>
              <div style={{ marginTop: "1rem" }}>
                <Button type="button" variant="primary" onClick={() => router.push("/tours")}>
                  Manage tours
                </Button>
              </div>
            </CardBody>
          </Card>
        </li>
        <li>
          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
            </CardHeader>
            <CardBody>
              <p>Your registrations and payment summaries (J‑P‑02, J‑P‑03).</p>
              <div style={{ marginTop: "1rem" }}>
                <Button type="button" variant="secondary" onClick={() => router.push("/bookings")}>
                  View bookings
                </Button>
              </div>
            </CardBody>
          </Card>
        </li>
        <li>
          <Card>
            <CardHeader>
              <CardTitle>Payments & reconciliation</CardTitle>
            </CardHeader>
            <CardBody>
              <p style={{ margin: 0 }}>
                Payment fields on each registration are updated via{" "}
                <strong>PATCH /api/v2/registrations/{"{id}"}/payment</strong> — use a tour workspace or the review
                queue.
              </p>
              <p style={{ marginTop: "0.65rem", marginBottom: 0 }}>
                {leader ? (
                  <>
                    Cross-tour CSV is generated in <strong>Review queue</strong> from live registrations (there is no{" "}
                    <code>/reconciliation/export.csv</code> route in OpenAPI yet).
                  </>
                ) : (
                  <>Your payment status follows your registration records under Bookings.</>
                )}
              </p>
            </CardBody>
          </Card>
        </li>
        {leader ? (
          <li>
            <Card>
              <CardHeader>
                <CardTitle>Registration review queue</CardTitle>
              </CardHeader>
              <CardBody>
                <p>Pulled from every tour listing your session can fetch as leader.</p>
                <p style={{ marginTop: "0.5rem" }}>
                  Pending registrations:{" "}
                  <Badge variant={leaderIndex.isLoading ? "neutral" : "warning"}>
                    {leaderIndex.isLoading ? "…" : leaderIndex.pendingCount}
                  </Badge>{" "}
                  · Rows loaded:{" "}
                  <Badge variant={leaderIndex.isLoading ? "neutral" : "info"}>
                    {leaderIndex.isLoading ? "…" : leaderIndex.totalRegistrationCount}
                  </Badge>
                </p>
                <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <Button type="button" variant="primary" onClick={() => router.push("/leader/review")}>
                    Open review queue
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void leaderIndex.refetchAll()}>
                    Refresh counts
                  </Button>
                  <Link href="/tours" style={{ alignSelf: "center", marginLeft: "0.35rem", fontWeight: 600 }}>
                    Manage tours →
                  </Link>
                </div>
              </CardBody>
            </Card>
          </li>
        ) : null}
      </ul>
      <Card style={{ marginTop: "1.5rem" }}>
        <CardBody>
          <p>
            Workspace users directory:{" "}
            <Link href="/users">Users</Link>
          </p>
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
