"use client";

import Link from "next/link";

import { Card, CardBody, CardFooter, CardHeader, CardSubtitle, CardTitle } from "@tour/ui";

import styles from "../dashboard.module.css";

export function UsersDirectoryWidget() {
  return (
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
  );
}
