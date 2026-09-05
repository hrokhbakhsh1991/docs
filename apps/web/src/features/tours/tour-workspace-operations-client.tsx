"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";

type ExecutionState =
  | "draft"
  | "manifest_locked"
  | "pre_tour"
  | "in_progress"
  | "post_tour"
  | "completed"
  | "cancelled";

type ExecutionPayload = {
  readonly state?: ExecutionState;
  readonly rowVersion?: number;
  readonly scheduledMeetingAt?: string | null;
  readonly meetingLocation?: string | null;
  readonly manifest?: ReadonlyArray<{
    readonly registrationId?: string;
    readonly guestLabel?: string;
    readonly paymentStatus?: string;
    readonly insuranceStatus?: string | null;
    readonly attendanceStatus?: string | null;
    readonly groupId?: string | null;
  }>;
  readonly groups?: ReadonlyArray<{
    readonly id?: string;
    readonly name?: string;
    readonly leaderUserId?: string | null;
  }>;
  readonly checklist?: ReadonlyArray<{
    readonly id?: string;
    readonly phase?: string;
    readonly label?: string;
    readonly completedAt?: string | null;
  }>;
  readonly operationalEvents?: ReadonlyArray<{
    readonly id?: string;
    readonly eventKind?: string;
    readonly severity?: string;
    readonly description?: string;
    readonly reportedAt?: string;
  }>;
};

const NEXT_STATE: Partial<Record<ExecutionState, ExecutionState>> = {
  manifest_locked: "pre_tour",
  pre_tour: "in_progress",
  in_progress: "post_tour",
  post_tour: "completed",
};

type TourWorkspaceOperationsClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

export function TourWorkspaceOperationsClient({
  session,
  tourId,
}: TourWorkspaceOperationsClientProps) {
  const t = useTranslations("tours.workspace.operations");
  const canManage = isAdminOrOwnerRole(session.role);
  const [execution, setExecution] = useState<ExecutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingTime, setMeetingTime] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/execution`, {
        cache: "no-store",
      });
      const body = (await res.json()) as ExecutionPayload & { code?: string };
      if (!res.ok) {
        setError(body.code ?? "TOUR_EXECUTION_FETCH_FAILED");
        setExecution(null);
        return;
      }
      setExecution(body);
      setMeetingLocation(body.meetingLocation ?? "");
      if (body.scheduledMeetingAt) {
        const dt = new Date(body.scheduledMeetingAt);
        if (!Number.isNaN(dt.getTime())) {
          setMeetingTime(dt.toISOString().slice(0, 16));
        }
      }
    } catch {
      setError("TOUR_EXECUTION_FETCH_FAILED");
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function apiPost(path: string, method: "POST" | "PATCH" | "PUT", body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}/execution${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        setError("TOUR_EXECUTION_ACTION_FAILED");
        return false;
      }
      await reload();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function lockManifest(): Promise<void> {
    await apiPost("/manifest/lock", "POST");
  }

  async function advanceState(): Promise<void> {
    const current = execution?.state;
    if (current === undefined || execution?.rowVersion === undefined) {
      return;
    }
    const target = NEXT_STATE[current];
    if (target === undefined) {
      return;
    }
    await apiPost("/state", "PATCH", {
      targetState: target,
      expectedVersion: execution.rowVersion,
    });
  }

  async function toggleChecklist(itemId: string, completed: boolean): Promise<void> {
    await apiPost(`/checklist/${encodeURIComponent(itemId)}`, "PATCH", { completed });
  }

  async function saveGroups(): Promise<void> {
    const name = groupName.trim();
    if (name.length === 0) {
      return;
    }
    const existing = execution?.groups ?? [];
    await apiPost("/groups", "PUT", {
      groups: [...existing.map((g) => ({ name: g.name, leaderUserId: g.leaderUserId ?? null })), { name }],
    });
    setGroupName("");
  }

  async function logOperationalEvent(): Promise<void> {
    const description = eventDescription.trim();
    if (description.length === 0) {
      return;
    }
    const ok = await apiPost("/operational-events", "POST", {
      eventKind: "note",
      severity: "info",
      description,
    });
    if (ok) {
      setEventDescription("");
    }
  }

  async function saveSchedule(): Promise<void> {
    if (meetingTime.trim().length === 0) {
      return;
    }
    await apiPost("/schedule", "PATCH", {
      scheduledMeetingAt: new Date(meetingTime).toISOString(),
      idempotencyKey: `schedule-${meetingTime}`,
    });
  }

  async function saveLocation(): Promise<void> {
    const loc = meetingLocation.trim();
    if (loc.length === 0) {
      return;
    }
    await apiPost("/location", "PATCH", {
      meetingLocation: loc,
      idempotencyKey: `location-${loc}`,
    });
  }

  const nextStateLabel = useMemo(() => {
    const current = execution?.state;
    if (current === undefined) {
      return null;
    }
    const next = NEXT_STATE[current];
    return next ?? null;
  }, [execution?.state]);

  if (loading) {
    return (
      <div data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <Card data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
        <CardContent className="pt-6 text-destructive" data-testid="ito-error">
          {t("error")}
        </CardContent>
      </Card>
    );
  }

  if (!canManage && session.role === "viewer") {
    return (
      <Card data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
        <CardContent className="pt-6" data-testid="ito-forbidden">
          {t("forbidden")}
        </CardContent>
      </Card>
    );
  }

  const manifest = execution?.manifest ?? [];
  const checklist = execution?.checklist ?? [];
  const groups = execution?.groups ?? [];
  const events = execution?.operationalEvents ?? [];

  return (
    <div className="space-y-4" data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>{t("title")}</CardTitle>
          <span data-testid="ito-execution-state">{execution?.state ?? "draft"}</span>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canManage ? (
            <>
              <Button
                type="button"
                data-testid="ito-lock-manifest"
                disabled={busy || execution?.state !== "draft"}
                onClick={() => void lockManifest()}
              >
                {t("lockManifest")}
              </Button>
              {nextStateLabel !== null ? (
                <Button
                  type="button"
                  data-testid="ito-advance-state"
                  disabled={busy}
                  onClick={() => void advanceState()}
                >
                  {t("advanceState", { state: nextStateLabel })}
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
        {(execution?.scheduledMeetingAt || execution?.meetingLocation) && (
          <CardContent className="text-sm text-muted-foreground" data-testid="ito-meeting-summary">
            {execution.scheduledMeetingAt ? (
              <p data-testid="ito-meeting-time">{execution.scheduledMeetingAt}</p>
            ) : null}
            {execution.meetingLocation ? (
              <p data-testid="ito-meeting-location">{execution.meetingLocation}</p>
            ) : null}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("manifestTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {manifest.length === 0 ? (
            <p data-testid="ito-manifest-empty">{t("manifestEmpty")}</p>
          ) : (
            <ul className="space-y-2" data-testid="ito-manifest-list">
              {manifest.map((row) => (
                <li key={row.registrationId ?? row.guestLabel} data-testid="ito-manifest-row">
                  <strong>{row.guestLabel}</strong> — {row.paymentStatus} /{" "}
                  {row.insuranceStatus ?? t("insuranceUnknown")} /{" "}
                  {row.attendanceStatus ?? t("attendancePending")}
                  {row.groupId ? ` · ${t("groupAssigned")}` : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("groupsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1" data-testid="ito-groups-list">
            {groups.length === 0 ? (
              <li data-testid="ito-groups-empty">{t("groupsEmpty")}</li>
            ) : (
              groups.map((group) => (
                <li key={group.id} data-testid="ito-group-row">
                  {group.name}
                </li>
              ))
            )}
          </ul>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Input
                data-testid="ito-group-name-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("groupNamePlaceholder")}
              />
              <Button
                type="button"
                data-testid="ito-add-group"
                disabled={busy || groupName.trim().length === 0}
                onClick={() => void saveGroups()}
              >
                {t("addGroup")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("checklistTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" data-testid="ito-checklist-list">
            {checklist.map((item) => {
              const done = item.completedAt !== null && item.completedAt !== undefined;
              return (
                <li key={item.id} className="flex items-center gap-2">
                  {canManage && item.id ? (
                    <Checkbox
                      data-testid="ito-checklist-toggle"
                      checked={done}
                      disabled={busy}
                      onCheckedChange={(value) => void toggleChecklist(item.id!, value === true)}
                    />
                  ) : null}
                  <span className={done ? "line-through opacity-70" : undefined}>{item.label}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("eventsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2" data-testid="ito-events-list">
            {events.length === 0 ? (
              <li data-testid="ito-events-empty">{t("eventsEmpty")}</li>
            ) : (
              events.map((ev) => (
                <li key={ev.id} data-testid="ito-event-row">
                  <strong>{ev.eventKind}</strong>: {ev.description}
                </li>
              ))
            )}
          </ul>
          {canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                data-testid="ito-event-description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder={t("eventDescriptionPlaceholder")}
              />
              <Button
                type="button"
                data-testid="ito-log-event"
                disabled={busy || eventDescription.trim().length === 0}
                onClick={() => void logOperationalEvent()}
              >
                {t("logEvent")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("changesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ito-meeting-time-input">{t("meetingTimeLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="ito-meeting-time-input"
                  type="datetime-local"
                  data-testid="ito-meeting-time-input"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
                <Button
                  type="button"
                  data-testid="ito-save-schedule"
                  disabled={busy || meetingTime.trim().length === 0}
                  onClick={() => void saveSchedule()}
                >
                  {t("saveSchedule")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ito-meeting-location-input">{t("meetingLocationLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="ito-meeting-location-input"
                  data-testid="ito-meeting-location-input"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder={t("meetingLocationPlaceholder")}
                />
                <Button
                  type="button"
                  data-testid="ito-save-location"
                  disabled={busy || meetingLocation.trim().length === 0}
                  onClick={() => void saveLocation()}
                >
                  {t("saveLocation")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
