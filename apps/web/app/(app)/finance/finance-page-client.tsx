"use client";

import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useAuth } from "@/lib/auth/auth-context";
import { useFinanceModuleAccess } from "@/lib/finance/use-finance-module-access";
import { Button, Card, CardBody, CardHeader, CardTitle, EmptyState } from "@tour/ui";

import { AdminReceiptReviewPanel } from "./components/admin-receipt-review-panel";
import { PaymentReceiptUploadPanel } from "./components/payment-receipt-upload-panel";
import { FINANCE_ROUTE_COPY } from "./finance-copy";
import styles from "./finance-page.module.css";

const copy = FINANCE_ROUTE_COPY.page;

export function FinancePageClient() {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();
  const { hasFinanceModule, canReviewReceipts } = useFinanceModuleAccess();

  const breadcrumbItems = [
    { label: copy.breadcrumbHome, href: "/dashboard" },
    { label: copy.breadcrumbFinance },
  ];

  if (isHydrated && isAuthenticated && !hasFinanceModule) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        description={copy.description}
        breadcrumbItems={breadcrumbItems}
      >
        <Card>
          <CardBody>
            <EmptyState
              title={copy.moduleDisabledTitle}
              description={copy.moduleDisabledDescription}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  {copy.breadcrumbHome}
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={copy.documentTitle}
      title={copy.title}
      description={copy.description}
      breadcrumbItems={breadcrumbItems}
    >
      <div className={styles.rtlRoot} dir="rtl">
        <div className={styles.grid}>
          {canReviewReceipts ? (
            <Card className={styles.gridReviewFullWidth}>
              <CardHeader>
                <CardTitle className={styles.sectionTitle}>{copy.reviewSectionTitle}</CardTitle>
              </CardHeader>
              <CardBody className={styles.sectionCardBody}>
                <AdminReceiptReviewPanel />
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className={styles.sectionTitle}>{copy.uploadSectionTitle}</CardTitle>
            </CardHeader>
            <CardBody className={styles.sectionCardBody}>
              <PaymentReceiptUploadPanel />
            </CardBody>
          </Card>
        </div>
      </div>
    </RegisteredWorkspacePage>
  );
}
