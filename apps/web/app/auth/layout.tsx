import Link from "next/link";
import type { ReactNode } from "react";

import { AuthLayout, Card, CardBody } from "@tour/ui";

import styles from "./auth-shell.module.css";

export default function AuthSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayout>
      <div className={styles.panel}>
        <Link href="/" className={styles.logo}>
          Tour Ops
        </Link>
        <Card className={styles.cardBox}>
          <CardBody>{children}</CardBody>
        </Card>
      </div>
    </AuthLayout>
  );
}
