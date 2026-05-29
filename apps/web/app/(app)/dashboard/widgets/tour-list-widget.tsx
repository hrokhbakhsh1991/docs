"use client";

import { useRouter } from "next/navigation";

import { useLeaderDashboardSummary } from "@/lib/hooks/useLeaderDashboardSummary";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, CardSubtitle, CardTitle } from "@tour/ui";

import styles from "../dashboard.module.css";

export function TourListWidget() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const enabled = liveApi && isHydrated && isAuthenticated && leader;
  const summaryQuery = useLeaderDashboardSummary(enabled);
  const tourTotal = summaryQuery.data?.tour_total ?? 0;

  return (
    <Card className={styles.gridCard}>
      <CardHeader>
        <CardTitle>Tours</CardTitle>
        <CardSubtitle>Tenant-scoped catalogue (J‑L‑01).</CardSubtitle>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <p className={styles.metricRow}>
          Loaded tours:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : "info"}>
            {summaryQuery.isPending ? "…" : tourTotal}
          </Badge>
        </p>
      </CardBody>
      <CardFooter>
        <Button type="button" variant="primary" onClick={() => router.push("/tours")}>
          Manage tours
        </Button>
      </CardFooter>
    </Card>
  );
}
