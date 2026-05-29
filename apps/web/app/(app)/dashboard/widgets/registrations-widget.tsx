"use client";

import { useRouter } from "next/navigation";

import { Button, Card, CardBody, CardFooter, CardHeader, CardSubtitle, CardTitle } from "@tour/ui";

import styles from "../dashboard.module.css";

export function RegistrationsWidget() {
  const router = useRouter();

  return (
    <Card className={styles.gridCard}>
      <CardHeader>
        <CardTitle>Registrations & payments</CardTitle>
        <CardSubtitle>
          Participant bookings live under their own workspace; leaders reconcile via the review queue and tour
          workspaces (J‑P‑02, J‑P‑03).
        </CardSubtitle>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <p className={styles.bodyText}>Use the review queue to approve registrations and update payment fields.</p>
      </CardBody>
      <CardFooter>
        <Button type="button" variant="primary" onClick={() => router.push("/leader/review")}>
          Open review queue
        </Button>
      </CardFooter>
    </Card>
  );
}
