"use client";

import { Card, CardBody, CardFooter, CardHeader, CardSubtitle, CardTitle } from "@tour/ui";

import styles from "../dashboard.module.css";

export function ReconciliationWidget() {
  return (
    <Card className={styles.gridCard}>
      <CardHeader>
        <CardTitle>Payments & reconciliation</CardTitle>
        <CardSubtitle>
          Payment fields on each registration are updated via{" "}
          <strong>PATCH /api/v2/registrations/{"{id}"}/payment</strong> — use a tour workspace or the review queue.
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
  );
}
