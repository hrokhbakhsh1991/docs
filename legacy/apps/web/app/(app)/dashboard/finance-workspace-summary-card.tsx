"use client";

import { useRouter } from "next/navigation";

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

import { useFinanceLedgerEvents } from "@/lib/hooks/useFinanceLedgerEvents";
import { useFinanceReportsSummary } from "@/lib/hooks/useFinanceReportsSummary";

import styles from "./dashboard.module.css";

type FinanceWorkspaceSummaryCardProps = {
  canReviewReceipts: boolean;
};

export function FinanceWorkspaceSummaryCard({
  canReviewReceipts,
}: FinanceWorkspaceSummaryCardProps) {
  const router = useRouter();
  const summaryQuery = useFinanceReportsSummary(true);
  const ledgerQuery = useFinanceLedgerEvents(true);
  const summary = summaryQuery.data;

  const pendingManual = summary?.pendingManualPayments ?? 0;
  const pendingReceipts = summary?.pendingReceiptReviews ?? 0;
  const paid = summary?.paidPayments ?? 0;
  const failed = summary?.failedPayments ?? 0;

  return (
    <Card className={styles.gridCard}>
      <CardHeader>
        <CardTitle>امور مالی ورک‌اسپیس</CardTitle>
        <CardSubtitle>پرداخت‌های دستی و صف بررسی فیش واریزی این ورک‌اسپیس.</CardSubtitle>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <p className={styles.metricRow}>
          پرداخت‌های دستی در انتظار:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : pendingManual > 0 ? "warning" : "info"}>
            {summaryQuery.isPending ? "…" : pendingManual}
          </Badge>
        </p>
        <p className={styles.metricRow}>
          فیش‌های در انتظار بررسی:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : pendingReceipts > 0 ? "warning" : "info"}>
            {summaryQuery.isPending ? "…" : pendingReceipts}
          </Badge>
        </p>
        <p className={styles.metricRow}>
          پرداخت‌شده · ناموفق:{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : "success"}>
            {summaryQuery.isPending ? "…" : paid}
          </Badge>{" "}
          ·{" "}
          <Badge variant={summaryQuery.isPending ? "neutral" : failed > 0 ? "warning" : "neutral"}>
            {summaryQuery.isPending ? "…" : failed}
          </Badge>
        </p>
        <p className={styles.metricRow}>
          دفتر رویدادهای اخیر:{" "}
          <Badge variant={ledgerQuery.isPending ? "neutral" : "info"}>
            {ledgerQuery.isPending ? "…" : (ledgerQuery.data?.length ?? 0)}
          </Badge>
        </p>
      </CardBody>
      <CardFooter>
        <Button
          type="button"
          variant={canReviewReceipts ? "primary" : "secondary"}
          onClick={() => router.push("/finance")}
        >
          {canReviewReceipts ? "باز کردن مرکز امور مالی" : "مشاهده مرکز امور مالی"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void summaryQuery.refetch();
            void ledgerQuery.refetch();
          }}
        >
          به‌روزرسانی
        </Button>
      </CardFooter>
    </Card>
  );
}
