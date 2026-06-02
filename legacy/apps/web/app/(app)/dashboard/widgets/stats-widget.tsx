"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLeaderDashboardSummary } from "@/lib/hooks/useLeaderDashboardSummary";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@tour/ui";

import styles from "../dashboard.module.css";

export function StatsWidget() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const enabled = liveApi && isHydrated && isAuthenticated && leader;
  const summaryQuery = useLeaderDashboardSummary(enabled);

  return (
    <Card className={styles.gridCard}>
      <CardHeader>
        <CardTitle>Registration review queue</CardTitle>
        <CardSubtitle>Tenant-wide counts from a single dashboard summary request.</CardSubtitle>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <p className={styles.metricRow}>
          Pending registrations:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : "warning"}>
            {summaryQuery.isPending ? "…" : (summaryQuery.data?.registration_pending_count ?? 0)}
          </Badge>{" "}
          · Rows loaded:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : "info"}>
            {summaryQuery.isPending ? "…" : (summaryQuery.data?.registration_total_count ?? 0)}
          </Badge>
        </p>
      </CardBody>
      <CardFooter>
        <Button type="button" variant="primary" onClick={() => router.push("/leader/review")}>
          Open review queue
        </Button>
        <Button type="button" variant="secondary" onClick={() => void summaryQuery.refetch()}>
          Refresh counts
        </Button>
        <Link href="/tours" className={styles.inlineLink}>
          Manage tours →
        </Link>
      </CardFooter>
    </Card>
  );
}
