"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CancellationQueueItem = {
  readonly id: string;
  readonly guestLabel: string;
  readonly tourTitle: string;
  readonly cancellationRequestedAt?: string | null;
};

export function MemberCancellationQueue() {
  const t = useTranslations("bookings.memberCancellationQueue");
  const router = useRouter();
  const [items, setItems] = useState<readonly CancellationQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/bookings/member-cancellation-requests?status=pending", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = (await response.json()) as { items?: readonly CancellationQueueItem[] };
      setItems(payload.items ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LOAD_FAILED");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (bookingId: string, decision: "approve" | "reject") => {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/member-cancellation/${decision}`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      await load();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "DECISION_FAILED");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card data-testid="member-cancellation-queue">
      <CardHeader>
        <CardTitle>{t("title", { count: items.length })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p role="alert">{t("error", { code: error })}</p> : null}
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div>
              <p className="font-medium">{item.guestLabel}</p>
              <p className="text-sm text-muted-foreground">{item.tourTitle}</p>
              <Link
                className="text-xs underline"
                href={`/bookings?bookingId=${encodeURIComponent(item.id)}`}
              >
                {t("openBooking", { id: item.id })}
              </Link>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId !== null}
                onClick={() => void decide(item.id, "reject")}
              >
                {t("reject")}
              </Button>
              <Button
                size="sm"
                disabled={busyId !== null}
                onClick={() => void decide(item.id, "approve")}
              >
                {t("approve")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
