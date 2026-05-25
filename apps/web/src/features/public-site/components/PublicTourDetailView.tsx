"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button, ErrorState, LoadingState } from "@tour/ui";

import { usePublicSiteConfig } from "@/features/public-site/context/public-site-config-context";
import { fetchPublicTourDetail } from "@/features/public-site/services/public-tours.service";

import styles from "./PublicTourDetailView.module.css";

export function PublicTourDetailView({ tourId }: { tourId: string }) {
  const config = usePublicSiteConfig();
  const query = useQuery({
    queryKey: ["public-tour", config.tenantSlug, tourId],
    queryFn: () => fetchPublicTourDetail(tourId),
    enabled: Boolean(tourId?.trim()),
  });

  if (query.isLoading) {
    return (
      <div className={styles.wrap}>
        <LoadingState message="در حال بارگذاری تور…" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className={styles.wrap}>
        <ErrorState
          title="تور یافت نشد"
          message="این تور وجود ندارد یا برای ثبت‌نام عمومی باز نیست."
        />
        <div className={styles.actions}>
          <Link href={config.catalog.listPath}>
            <Button type="button" variant="secondary">
              بازگشت به فهرست
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const tour = query.data;
  const requiresPayment =
    tour.costContext != null &&
    typeof tour.costContext === "object" &&
    Boolean(
      (tour.costContext as { requiresPayment?: boolean }).requiresPayment ??
        (tour.costContext as { requires_payment?: boolean }).requires_payment,
    );

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{tour.title}</h1>
      {tour.description ? <p className={styles.description}>{tour.description}</p> : null}
      <dl className={styles.facts}>
        <div>
          <dt>وضعیت</dt>
          <dd>{tour.lifecycleStatus}</dd>
        </div>
        <div>
          <dt>ظرفیت</dt>
          <dd>
            {tour.acceptedCount} / {tour.totalCapacity}
          </dd>
        </div>
        <div>
          <dt>پرداخت</dt>
          <dd>{requiresPayment ? "پرداخت هنگام ثبت‌نام" : "بدون پرداخت آنلاین"}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <Link href={config.catalog.registerPath(tourId)}>
          <Button type="button" variant="primary">
            ثبت‌نام
          </Button>
        </Link>
        <Link href={config.catalog.listPath}>
          <Button type="button" variant="secondary">
            همه تورها
          </Button>
        </Link>
      </div>
    </div>
  );
}
