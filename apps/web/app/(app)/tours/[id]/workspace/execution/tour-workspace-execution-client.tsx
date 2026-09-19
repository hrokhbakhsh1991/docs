"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import type { TourOperationalRosterResponse } from "@/features/tours/tour-workspace-transport-logic";
import type { AppLocale } from "@/i18n/routing";

type AttendanceStatus = "not_arrived" | "present" | "departed" | "cancelled";

type DriverFact = {
  readonly driverRegistrationId: string;
  readonly offeredPassengerCapacity: number;
  readonly actualPassengerCount: number;
  readonly attendanceStatus: AttendanceStatus;
  readonly version: number;
  readonly lastEditedAt: string;
};

type Execution = {
  readonly status: "scheduled" | "in_progress" | "completed" | "cancelled";
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

type ExecutionPayload = {
  readonly execution: Execution | null;
  readonly driverFacts: readonly DriverFact[];
};

type DriverDraft = {
  readonly actualPassengerCount: string;
  readonly attendanceStatus: AttendanceStatus;
  readonly version: number;
};

function responseErrorCode(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = payload as { code?: unknown; error?: { code?: unknown } };
  if (typeof value.code === "string") return value.code;
  return typeof value.error?.code === "string" ? value.error.code : null;
}

function toDraft(fact: DriverFact): DriverDraft {
  return {
    actualPassengerCount: String(fact.actualPassengerCount),
    attendanceStatus: fact.attendanceStatus,
    version: fact.version,
  };
}

export function TourWorkspaceExecutionClient({
  tourId,
  canManage,
}: {
  readonly tourId: string;
  readonly canManage: boolean;
}) {
  const t = useTranslations("tours.workspace.execution");
  const locale = useLocale() as AppLocale;
  const [payload, setPayload] = useState<ExecutionPayload | null>(null);
  const [driverLabels, setDriverLabels] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, DriverDraft>>({});
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState<"start" | "complete" | string | null>(null);
  const [message, setMessage] = useState<{
    readonly kind: "error" | "success";
    readonly value: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [executionResponse, rosterResponse] = await Promise.all([
        fetch(`/api/tours/${encodeURIComponent(tourId)}/execution`, { cache: "no-store" }),
        fetch(`/api/tours/${encodeURIComponent(tourId)}/operational-roster?filter=operational`, {
          cache: "no-store",
        }),
      ]);
      if (!executionResponse.ok || !rosterResponse.ok) {
        throw new Error("EXECUTION_LOAD_FAILED");
      }
      const executionPayload = (await executionResponse.json()) as ExecutionPayload;
      const rosterPayload = (await rosterResponse.json()) as TourOperationalRosterResponse;
      const labels: Record<string, string> = {};
      for (const row of rosterPayload.items ?? []) {
        if (row.transportKind === "personal_car") {
          labels[row.registrationId] = row.guestLabel;
        }
      }
      setPayload(executionPayload);
      setDriverLabels(labels);
      setDrafts(
        Object.fromEntries(
          executionPayload.driverFacts.map((fact) => [fact.driverRegistrationId, toDraft(fact)])
        )
      );
      setMessage(null);
    } catch {
      setPayload(null);
      setDriverLabels({});
      setMessage({ kind: "error", value: t("errors.load") });
    } finally {
      setLoading(false);
    }
  }, [t, tourId]);

  useEffect(() => {
    void load();
  }, [load]);

  const facts = payload?.driverFacts ?? [];
  const isEditable = payload?.execution?.status === "in_progress" && canManage;
  const isTerminal =
    payload?.execution?.status === "completed" || payload?.execution?.status === "cancelled";
  const statusLabel = useMemo(
    () =>
      payload?.execution === null || payload?.execution === undefined
        ? "notStarted"
        : payload.execution.status,
    [payload]
  );

  async function start(): Promise<void> {
    setCommand("start");
    setMessage(null);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/execution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(responseErrorCode(body) ?? "EXECUTION_START_FAILED");
      }
      await load();
      setMessage({ kind: "success", value: t("started") });
    } catch (error) {
      setMessage({
        kind: "error",
        value: t("errors.start", { code: error instanceof Error ? error.message : "unknown" }),
      });
    } finally {
      setCommand(null);
    }
  }

  async function complete(): Promise<void> {
    setCommand("complete");
    setMessage(null);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}/execution/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(responseErrorCode(body) ?? "EXECUTION_COMPLETE_FAILED");
      }
      await load();
      setMessage({ kind: "success", value: t("completed") });
    } catch (error) {
      setMessage({
        kind: "error",
        value: t("errors.complete", { code: error instanceof Error ? error.message : "unknown" }),
      });
    } finally {
      setCommand(null);
    }
  }

  async function saveFact(fact: DriverFact): Promise<void> {
    const draft = drafts[fact.driverRegistrationId];
    if (draft === undefined) return;
    setCommand(fact.driverRegistrationId);
    setMessage(null);
    try {
      const actualPassengerCount = Number(draft.actualPassengerCount);
      const response = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/execution/drivers/${encodeURIComponent(fact.driverRegistrationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedVersion: draft.version,
            actualPassengerCount,
            attendanceStatus: draft.attendanceStatus,
          }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(responseErrorCode(body) ?? "EXECUTION_SAVE_FAILED");
      }
      await load();
      setMessage({ kind: "success", value: t("saved") });
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown";
      setMessage({
        kind: "error",
        value: code === "STALE_EXECUTION_VERSION" ? t("errors.stale") : t("errors.save", { code }),
      });
    } finally {
      setCommand(null);
    }
  }

  return (
    <Card
      data-operator-surface="card"
      data-testid={TOUR_WORKSPACE_TEST_IDS.executionPanel}
      className="shadow-sm"
    >
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Badge variant={payload?.execution?.status === "in_progress" ? "default" : "secondary"}>
            {t(`status.${statusLabel}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {t("noFinancialSideEffect")}
        </p>
        {message !== null ? (
          <p
            className={
              message.kind === "error"
                ? "text-sm text-destructive"
                : "text-sm text-emerald-700 dark:text-emerald-400"
            }
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.value}
          </p>
        ) : null}
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {!loading && payload?.execution === null ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t("notStartedDescription")}</p>
            <Button
              type="button"
              onClick={() => void start()}
              disabled={!canManage || command !== null}
            >
              {command === "start" ? t("starting") : t("start")}
            </Button>
          </div>
        ) : null}
        {!loading && payload?.execution !== null && payload?.execution !== undefined ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <span>
                {payload.execution.startedAt === null
                  ? t("startedAtPending")
                  : t("startedAt", {
                      value: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(payload.execution.startedAt)),
                    })}
              </span>
              {payload.execution.completedAt !== null ? (
                <span>
                  {t("completedAt", {
                    value: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(payload.execution.completedAt)),
                  })}
                </span>
              ) : null}
              {!isTerminal ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void complete()}
                  disabled={!canManage || command !== null}
                >
                  {command === "complete" ? t("completing") : t("complete")}
                </Button>
              ) : null}
            </div>
            {facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noDrivers")}</p>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-2">
              {facts.map((fact) => {
                const draft = drafts[fact.driverRegistrationId] ?? toDraft(fact);
                const capacityId = `execution-capacity-${fact.driverRegistrationId}`;
                const attendanceId = `execution-attendance-${fact.driverRegistrationId}`;
                return (
                  <section
                    key={fact.driverRegistrationId}
                    className="space-y-3 rounded-lg border p-4"
                    aria-label={driverLabels[fact.driverRegistrationId] ?? t("driverUnknown")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {driverLabels[fact.driverRegistrationId] ?? t("driverUnknown")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("capacity", { count: fact.offeredPassengerCapacity })}
                        </p>
                      </div>
                      <Badge variant="outline">{t(`attendance.${draft.attendanceStatus}`)}</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={capacityId}>{t("actualPassengerCount")}</Label>
                        <Input
                          id={capacityId}
                          type="number"
                          min={0}
                          max={fact.offeredPassengerCapacity}
                          inputMode="numeric"
                          value={draft.actualPassengerCount}
                          disabled={!isEditable || command === fact.driverRegistrationId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [fact.driverRegistrationId]: {
                                ...draft,
                                actualPassengerCount: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={attendanceId}>{t("attendanceLabel")}</Label>
                        <select
                          id={attendanceId}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={draft.attendanceStatus}
                          disabled={!isEditable || command === fact.driverRegistrationId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [fact.driverRegistrationId]: {
                                ...draft,
                                attendanceStatus: event.target.value as AttendanceStatus,
                              },
                            }))
                          }
                        >
                          <option value="not_arrived">{t("attendance.not_arrived")}</option>
                          <option value="present">{t("attendance.present")}</option>
                          <option value="departed">{t("attendance.departed")}</option>
                          <option value="cancelled">{t("attendance.cancelled")}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {t("lastSaved", {
                          value: new Intl.DateTimeFormat(locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(fact.lastEditedAt)),
                        })}
                      </p>
                      {isEditable ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveFact(fact)}
                          disabled={command !== null}
                        >
                          {command === fact.driverRegistrationId ? t("saving") : t("save")}
                        </Button>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
