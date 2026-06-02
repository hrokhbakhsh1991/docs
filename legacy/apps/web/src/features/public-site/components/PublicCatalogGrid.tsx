"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState, LoadingState } from "@tour/ui";

import { usePublicSiteConfig } from "@/features/public-site/context/public-site-config-context";
import { fetchPublicCatalog } from "@/features/public-site/services/public-tours.service";
import { publicCatalogDetailPath } from "@/lib/paths";

import styles from "./PublicCatalogGrid.module.css";

export function PublicCatalogGrid() {
  const config = usePublicSiteConfig();
  const query = useQuery({
    queryKey: ["public-catalog", config.tenantSlug, config.catalog.apiStatus],
    queryFn: () =>
      fetchPublicCatalog({
        limit: 48,
        apiStatus: config.catalog.apiStatus,
      }),
  });

  if (query.isLoading) {
    return (
      <div className={styles.wrap}>
        <LoadingState message="در حال بارگذاری تورها…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={styles.wrap}>
        <ErrorState
          title="خطا در بارگذاری"
          message="فهرست تورها در دسترس نیست. بعداً دوباره تلاش کنید."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const tours = query.data?.tours ?? [];

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        تورهای باز ({config.programLabel}) —
        ثبت‌نام بدون ورود به پنل.
      </p>
      {tours.length === 0 ? (
        <EmptyState
          title="توری برای نمایش نیست"
          description="در حال حاضر تور باز (OPEN) برای این workspace ثبت نشده است."
        />
      ) : (
        <div className={styles.grid}>
          {tours.map((tour) => (
            <Link
              key={tour.id}
              href={publicCatalogDetailPath(tour.id)}
              className={styles.card}
            >
              <h2 className={styles.title}>{tour.title}</h2>
              <p className={styles.meta}>
                ظرفیت: {tour.acceptedCount}/{tour.totalCapacity} · {tour.priceDisplay}
              </p>
              <span className={styles.actions}>مشاهده و ثبت‌نام ←</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
