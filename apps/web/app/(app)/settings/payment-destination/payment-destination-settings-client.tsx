"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { SettingsPageShell } from "@/admin/patterns/settings-page-shell";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";

type PaymentDestinationPayload = {
  enabled: boolean;
  cardNumber: string;
  cardHolderName: string;
  bankName: string | null;
  instructions: string | null;
};

type SettingsResponse = {
  configVersion: number;
  payload: PaymentDestinationPayload;
};

export const PAYMENT_DESTINATION_SETTINGS_TEST_IDS = {
  page: "payment-destination-settings-page",
  form: "payment-destination-settings-form",
  cardNumber: "payment-destination-card-number",
  cardHolderName: "payment-destination-card-holder-name",
  bankName: "payment-destination-bank-name",
  instructions: "payment-destination-instructions",
  enabled: "payment-destination-enabled",
  save: "payment-destination-save",
  success: "payment-destination-success",
  error: "payment-destination-error",
} as const;

type Props = { readonly session: OperatorSessionContext };

const emptyPayload: PaymentDestinationPayload = {
  enabled: false,
  cardNumber: "",
  cardHolderName: "",
  bankName: null,
  instructions: null,
};

export function PaymentDestinationSettingsClient({ session }: Props) {
  const canManage = isAdminOrOwnerRole(session.role);
  const [configVersion, setConfigVersion] = useState(1);
  const [payload, setPayload] = useState<PaymentDestinationPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/config/payment_destination", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PAYMENT_DESTINATION_GET_${response.status}`);
        }
        return (await response.json()) as SettingsResponse;
      })
      .then((result) => {
        if (!cancelled) {
          setConfigVersion(result.configVersion);
          setPayload({ ...emptyPayload, ...result.payload });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "PAYMENT_DESTINATION_GET_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/settings/config/payment_destination", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configVersion, payload }),
      });
      if (!response.ok) {
        throw new Error(`PAYMENT_DESTINATION_PUT_${response.status}`);
      }
      const result = (await response.json()) as SettingsResponse;
      setConfigVersion(result.configVersion);
      setPayload({ ...emptyPayload, ...result.payload });
      setSuccess(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "PAYMENT_DESTINATION_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageShell
      testId={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.page}
      maxWidth="3xl"
      data-can-manage={canManage ? "true" : "false"}
    >
      <SettingsPageHeader
        title="تنظیم مقصد پرداخت"
        description="مقصد امن پرداخت کارت‌به‌کارت برای اعضای workspace را مدیریت کنید."
      />
      {!canManage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          این بخش فقط برای مدیر یا مالک workspace قابل ویرایش است.
        </p>
      ) : null}
      <Card data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.form}>
        <CardHeader>
          <CardTitle>مقصد کارت‌به‌کارت</CardTitle>
          <CardDescription>
            اطلاعات کارت فقط برای ثبت‌نام‌های واجد شرایط در پورتال عضو نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? <p role="status">در حال بارگذاری…</p> : null}
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.enabled}
              checked={payload.enabled}
              disabled={!canManage || loading || saving}
              onChange={(event) =>
                setPayload((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
            مقصد پرداخت فعال است
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardNumber}>شماره کارت</Label>
              <Input
                id={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardNumber}
                data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardNumber}
                inputMode="numeric"
                value={payload.cardNumber}
                disabled={!canManage || loading || saving}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, cardNumber: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardHolderName}>
                نام دارنده کارت
              </Label>
              <Input
                id={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardHolderName}
                data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.cardHolderName}
                value={payload.cardHolderName}
                disabled={!canManage || loading || saving}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, cardHolderName: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.bankName}>نام بانک</Label>
            <Input
              id={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.bankName}
              data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.bankName}
              value={payload.bankName ?? ""}
              disabled={!canManage || loading || saving}
              onChange={(event) =>
                setPayload((current) => ({ ...current, bankName: event.target.value || null }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.instructions}>راهنما</Label>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              id={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.instructions}
              data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.instructions}
              value={payload.instructions ?? ""}
              disabled={!canManage || loading || saving}
              onChange={(event) =>
                setPayload((current) => ({
                  ...current,
                  instructions: event.target.value || null,
                }))
              }
            />
          </div>
          {error !== null ? (
            <p role="alert" data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.error}>
              ذخیره مقصد پرداخت ناموفق بود: {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.success}>
              مقصد پرداخت با موفقیت ذخیره شد.
            </p>
          ) : null}
          <Button
            type="button"
            data-testid={PAYMENT_DESTINATION_SETTINGS_TEST_IDS.save}
            disabled={!canManage || loading || saving}
            onClick={() => void save()}
          >
            {saving ? "در حال ذخیره…" : "ذخیره مقصد پرداخت"}
          </Button>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
