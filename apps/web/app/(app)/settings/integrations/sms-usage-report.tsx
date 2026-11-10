"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Usage = { total: number; accepted: number; failed: number; unknown: number };

export function SmsUsageReport({ workspaceId }: { readonly workspaceId: string }) {
  const t = useTranslations("settings.integrations.smsUsage");
  const locale = useLocale();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setUsage(null);
    setFailed(false);
    void fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/sms-usage`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("SMS_USAGE_UNAVAILABLE");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") throw new Error("SMS_USAGE_INVALID");
        const value = data as Record<string, unknown>;
        if (!["total", "accepted", "failed", "unknown"].every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0)) throw new Error("SMS_USAGE_INVALID");
        setUsage(value as Usage);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [workspaceId]);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <Card data-testid="sms-usage-report">
      <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{t("period")}</p>
        {failed ? <p role="alert">{t("unavailable")}</p> : !usage ? <p>{t("loading")}</p> : (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["total", "accepted", "failed", "unknown"] as const).map((key) => (
              <div key={key}><dt>{t(key)}</dt><dd>{number(usage[key])}</dd></div>
            ))}
          </dl>
        )}
        <p>{t("costUnknown")}</p>
      </CardContent>
    </Card>
  );
}
