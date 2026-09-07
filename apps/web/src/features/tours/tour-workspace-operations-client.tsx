"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { useTourWorkspaceChrome } from "@/features/tours/tour-workspace-chrome-context";
import type { InTourOpsPanels } from "@/features/tours/in-tour-ops-enablement";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import { cn } from "@/lib/utils";

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
  readonly tourLeaderUserId?: string | null;
  readonly tourLeaderDisplayName?: string | null;
  readonly manifestLockedAt?: string | null;
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

type LeaderDirectoryRow = {
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly isSelectableLeader?: boolean;
};

function isLeaderCandidate(row: LeaderDirectoryRow): boolean {
  if (row.role === "admin" || row.role === "owner") {
    return true;
  }
  return row.isSelectableLeader === true;
}

const NEXT_STATE: Partial<Record<ExecutionState, ExecutionState>> = {
  manifest_locked: "pre_tour",
  pre_tour: "in_progress",
  in_progress: "post_tour",
  post_tour: "completed",
};

type TourWorkspaceOperationsClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly panels: InTourOpsPanels;
};

function formatMeetingTime(iso: string | null | undefined): string | null {
  if (iso == null || iso.trim().length === 0) {
    return null;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return iso;
  }
  return dt.toLocaleString();
}

export function TourWorkspaceOperationsClient({
  session,
  tourId,
  panels,
}: TourWorkspaceOperationsClientProps) {
  const t = useTranslations("tours.workspace.operations");
  const { navigateWorkspaceTab } = useTourWorkspaceChrome();
  const canManage = isAdminOrOwnerRole(session.role);
  const [execution, setExecution] = useState<ExecutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [leaderOptions, setLeaderOptions] = useState<readonly SelectOption[]>([]);

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

  useEffect(() => {
    if (!canManage) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/users?limit=100&status=active&sort=name_asc", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) {
          return;
        }
        const body = (await res.json()) as { items?: LeaderDirectoryRow[] };
        const options: SelectOption[] = [
          { value: "", label: t("tourLeaderUnsetOption") },
          ...(body.items ?? [])
            .filter(isLeaderCandidate)
            .map((row) => ({ value: row.userId, label: row.displayName })),
        ];
        setLeaderOptions(options);
      } catch {
        /* leader picker stays empty until retry via reload */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, t]);

  async function saveTourLeader(nextLeaderUserId: string | null): Promise<void> {
    setBusy(true);
    setActionNotice(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/execution/tour-leader`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourLeaderUserId: nextLeaderUserId }),
        },
      );
      if (!res.ok) {
        setError("TOUR_EXECUTION_LEADER_FAILED");
        return;
      }
      setActionNotice(
        nextLeaderUserId
          ? t("tourLeaderAssignedSuccess")
          : t("tourLeaderUnsetSuccess"),
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function downloadManifestExport(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tours/${encodeURIComponent(tourId)}/execution/manifest-export`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError("TOUR_EXECUTION_EXPORT_FAILED");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename=\"?([^\";]+)\"?/i.exec(cd);
      const filename = match?.[1] ?? `manifest-${tourId.slice(0, 8)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setActionNotice(t("exportSuccess"));
    } finally {
      setBusy(false);
    }
  }

  async function apiPost(
    path: string,
    method: "POST" | "PATCH" | "PUT",
    body?: unknown,
  ): Promise<boolean> {
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
      setError(null);
      await reload();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function markAttendance(
    registrationId: string,
    attendanceStatus: "present" | "absent",
  ): Promise<void> {
    setBusy(true);
    setActionNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(registrationId)}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceStatus }),
      });
      if (!res.ok) {
        setError("TOUR_EXECUTION_ATTENDANCE_FAILED");
        return;
      }
      setActionNotice(
        t(attendanceStatus === "present" ? "attendancePresentSuccess" : "attendanceAbsentSuccess"),
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = useMemo(() => {
    const state = execution?.state;
    if (state === undefined) {
      return t("stateUnknown");
    }
    return t(`states.${state}`);
  }, [execution?.state, t]);

  const nextState = useMemo(() => {
    const current = execution?.state;
    if (current === undefined) {
      return null;
    }
    return NEXT_STATE[current] ?? null;
  }, [execution?.state]);

  const lockManifestAction = useMemo(() => {
    if (!canManage || execution?.state !== "draft") {
      return null;
    }
    return {
      testId: "ito-lock-manifest",
      label: t("lockManifest"),
      onClick: () => void apiPost("/manifest/lock", "POST"),
      disabled: busy,
    };
  }, [busy, canManage, execution?.state, t]);

  const advanceStateAction = useMemo(() => {
    if (!canManage || execution?.state === undefined || execution.state === "draft") {
      return null;
    }
    if (nextState !== null && execution.rowVersion !== undefined) {
      return {
        testId: "ito-advance-state",
        label: t("advanceState", { state: t(`states.${nextState}`) }),
        onClick: () =>
          void apiPost("/state", "PATCH", {
            targetState: nextState,
            expectedVersion: execution.rowVersion,
          }),
        disabled: busy,
      };
    }
    return null;
  }, [busy, canManage, execution, nextState, t]);

  if (loading) {
    return (
      <div className="space-y-4" data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error !== null && execution === null) {
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
  const manifestExportEnabled =
    execution?.manifestLockedAt != null && execution?.state !== "draft";
  const meetingTimeLabel = formatMeetingTime(execution?.scheduledMeetingAt);
  const showOptionalGroups = panels.groups;
  const showOptionalChecklists = panels.checklists;
  const showOptionalEvents = panels.incidentLog;
  const groups = execution?.groups ?? [];
  const checklist = execution?.checklist ?? [];
  const events = execution?.operationalEvents ?? [];

  return (
    <div className="space-y-4" data-testid={TOUR_WORKSPACE_TEST_IDS.operationsPanel}>
      {actionNotice !== null ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="ito-action-notice">
          {actionNotice}
        </p>
      ) : null}

      {error !== null ? (
        <p className="text-sm text-destructive" data-testid="ito-inline-error">
          {t("actionFailed")}
        </p>
      ) : null}

      <Card data-testid="ito-manifest-card">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{t("manifestTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {manifest.length > 0 ? (
              <span className="text-sm text-muted-foreground" data-testid="ito-manifest-count">
                {t("manifestCount", { count: manifest.length })}
              </span>
            ) : null}
            {lockManifestAction !== null ? (
              <Button
                type="button"
                size="sm"
                data-testid={lockManifestAction.testId}
                disabled={lockManifestAction.disabled}
                onClick={lockManifestAction.onClick}
              >
                {lockManifestAction.label}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="ito-export-manifest"
                disabled={busy || !manifestExportEnabled}
                onClick={() => void downloadManifestExport()}
              >
                {t("exportManifest")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {manifest.length === 0 ? (
            <div className="space-y-3" data-testid="ito-manifest-empty">
              <p className="text-sm text-muted-foreground">{t("manifestEmpty")}</p>
              <ol
                className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground"
                data-testid="ito-manifest-empty-checklist"
              >
                <li>{t("manifestEmptyStepApprove")}</li>
                <li>{t("manifestEmptyStepLock")}</li>
                <li>{t("manifestEmptyStepRun")}</li>
              </ol>
              {navigateWorkspaceTab !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="ito-go-registrations"
                  onClick={() => navigateWorkspaceTab("registrations")}
                >
                  {t("goRegistrations")}
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block" data-testid="ito-manifest-table">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-start text-muted-foreground">
                      <th className="px-2 py-2 font-medium">{t("columnGuest")}</th>
                      <th className="px-2 py-2 font-medium">{t("columnPayment")}</th>
                      <th className="px-2 py-2 font-medium">{t("columnInsurance")}</th>
                      <th className="px-2 py-2 font-medium">{t("columnAttendance")}</th>
                      {canManage ? <th className="px-2 py-2 font-medium">{t("columnActions")}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.map((row) => (
                      <tr
                        key={row.registrationId ?? row.guestLabel}
                        className="border-b last:border-0"
                        data-testid="ito-manifest-row"
                      >
                        <td className="px-2 py-3 font-medium">{row.guestLabel}</td>
                        <td className="px-2 py-3">
                          <ReadinessBadge value={row.paymentStatus} testId="ito-payment-status" />
                        </td>
                        <td className="px-2 py-3">
                          <ReadinessBadge
                            value={row.insuranceStatus ?? t("insuranceUnknown")}
                            testId="ito-insurance-status"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <ReadinessBadge
                            value={row.attendanceStatus ?? t("attendancePending")}
                            testId="ito-attendance-status"
                          />
                        </td>
                        {canManage && row.registrationId ? (
                          <td className="px-2 py-3">
                            <AttendanceActions
                              busy={busy}
                              current={row.attendanceStatus}
                              onMark={(status) => void markAttendance(row.registrationId!, status)}
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden" data-testid="ito-manifest-list">
                {manifest.map((row) => (
                  <li
                    key={row.registrationId ?? row.guestLabel}
                    className="rounded-lg border p-3"
                    data-testid="ito-manifest-row"
                  >
                    <p className="font-medium">{row.guestLabel}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ReadinessBadge value={row.paymentStatus} testId="ito-payment-status" />
                      <ReadinessBadge
                        value={row.insuranceStatus ?? t("insuranceUnknown")}
                        testId="ito-insurance-status"
                      />
                      <ReadinessBadge
                        value={row.attendanceStatus ?? t("attendancePending")}
                        testId="ito-attendance-status"
                      />
                    </div>
                    {canManage && row.registrationId ? (
                      <div className="mt-3">
                        <AttendanceActions
                          busy={busy}
                          current={row.attendanceStatus}
                          onMark={(status) => void markAttendance(row.registrationId!, status)}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <details className="rounded-xl border bg-card" data-testid="ito-lifecycle" open>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          {t("lifecycleSummary")}
        </summary>
        <div className="space-y-4 border-t px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <OperatorStatusBadge variant="outline" data-testid="ito-execution-state">
                  {stateLabel}
                </OperatorStatusBadge>
                {canManage ? (
                  <div className="min-w-[12rem] flex-1 sm:max-w-xs" data-testid="ito-tour-leader-picker">
                    <Select
                      aria-label={t("tourLeaderPickerLabel")}
                      disabled={busy}
                      options={leaderOptions}
                      value={execution?.tourLeaderUserId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        void saveTourLeader(value.length > 0 ? value : null);
                      }}
                    />
                  </div>
                ) : execution?.tourLeaderDisplayName ? (
                  <span className="text-sm text-muted-foreground" data-testid="ito-tour-leader">
                    {t("tourLeaderNamed", { name: execution.tourLeaderDisplayName })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground" data-testid="ito-tour-leader-empty">
                    {t("tourLeaderUnset")}
                  </span>
                )}
              </div>
            </div>
            {advanceStateAction !== null ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                data-testid={advanceStateAction.testId}
                disabled={advanceStateAction.disabled}
                onClick={advanceStateAction.onClick}
              >
                {advanceStateAction.label}
              </Button>
            ) : null}
          </div>
          {(meetingTimeLabel || execution?.meetingLocation) && (
            <div className="text-sm text-muted-foreground" data-testid="ito-meeting-summary">
              {meetingTimeLabel ? (
                <p data-testid="ito-meeting-time">
                  {t("meetingTimeSummary", { time: meetingTimeLabel })}
                </p>
              ) : null}
              {execution?.meetingLocation ? (
                <p data-testid="ito-meeting-location">
                  {t("meetingLocationSummary", { location: execution.meetingLocation })}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </details>

      {canManage ? (
        <details className="rounded-xl border bg-card" data-testid="ito-notify-changes">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("changesTitle")}</summary>
          <div className="space-y-4 border-t px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ito-meeting-time-input">{t("meetingTimeLabel")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ito-meeting-time-input"
                  type="datetime-local"
                  data-testid="ito-meeting-time-input"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="ito-save-schedule"
                  disabled={busy || meetingTime.trim().length === 0}
                  onClick={() =>
                    void apiPost("/schedule", "PATCH", {
                      scheduledMeetingAt: new Date(meetingTime).toISOString(),
                      idempotencyKey: `schedule-${meetingTime}`,
                    })
                  }
                >
                  {t("saveSchedule")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ito-meeting-location-input">{t("meetingLocationLabel")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ito-meeting-location-input"
                  data-testid="ito-meeting-location-input"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder={t("meetingLocationPlaceholder")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="ito-save-location"
                  disabled={busy || meetingLocation.trim().length === 0}
                  onClick={() =>
                    void apiPost("/location", "PATCH", {
                      meetingLocation: meetingLocation.trim(),
                      idempotencyKey: `location-${meetingLocation.trim()}`,
                    })
                  }
                >
                  {t("saveLocation")}
                </Button>
              </div>
            </div>
          </div>
        </details>
      ) : null}

      {showOptionalGroups ? (
        <Card data-testid="ito-groups-panel">
          <CardHeader>
            <CardTitle className="text-lg">{t("groupsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1" data-testid="ito-groups-list">
              {groups.length === 0 ? (
                <li className="text-sm text-muted-foreground" data-testid="ito-groups-empty">
                  {t("groupsEmpty")}
                </li>
              ) : (
                groups.map((group) => (
                  <li key={group.id} data-testid="ito-group-row">
                    {group.name}
                  </li>
                ))
              )}
            </ul>
            {canManage ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  data-testid="ito-group-name-input"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t("groupNamePlaceholder")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="ito-add-group"
                  disabled={busy || groupName.trim().length === 0}
                  onClick={() => {
                    const name = groupName.trim();
                    if (name.length === 0) {
                      return;
                    }
                    void apiPost("/groups", "PUT", {
                      groups: [
                        ...groups.map((g) => ({
                          name: g.name,
                          leaderUserId: g.leaderUserId ?? null,
                        })),
                        { name },
                      ],
                    }).then((ok) => {
                      if (ok) {
                        setGroupName("");
                      }
                    });
                  }}
                >
                  {t("addGroup")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showOptionalChecklists ? (
        <Card data-testid="ito-checklist-panel">
          <CardHeader>
            <CardTitle className="text-lg">{t("checklistTitle")}</CardTitle>
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
                        onCheckedChange={(value) =>
                          void apiPost(`/checklist/${encodeURIComponent(item.id!)}`, "PATCH", {
                            completed: value === true,
                          })
                        }
                      />
                    ) : null}
                    <span className={cn(done && "line-through opacity-70")}>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {showOptionalEvents ? (
        <Card data-testid="ito-events-panel">
          <CardHeader>
            <CardTitle className="text-lg">{t("eventsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2" data-testid="ito-events-list">
              {events.length === 0 ? (
                <li className="text-sm text-muted-foreground" data-testid="ito-events-empty">
                  {t("eventsEmpty")}
                </li>
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
                  variant="secondary"
                  data-testid="ito-log-event"
                  disabled={busy || eventDescription.trim().length === 0}
                  onClick={() => {
                    const description = eventDescription.trim();
                    if (description.length === 0) {
                      return;
                    }
                    void apiPost("/operational-events", "POST", {
                      eventKind: "note",
                      severity: "info",
                      description,
                    }).then((ok) => {
                      if (ok) {
                        setEventDescription("");
                      }
                    });
                  }}
                >
                  {t("logEvent")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReadinessBadge({
  value,
  testId,
}: {
  readonly value: string | null | undefined;
  readonly testId: string;
}) {
  const normalized = (value ?? "").trim().toLowerCase();
  const variant =
    normalized.includes("paid") ||
    normalized.includes("approved") ||
    normalized === "present" ||
    normalized.includes("confirmed")
      ? "default"
      : normalized.includes("pending") || normalized === "absent"
        ? "secondary"
        : "outline";
  return (
    <OperatorStatusBadge variant={variant} data-testid={testId}>
      {value ?? "—"}
    </OperatorStatusBadge>
  );
}

function AttendanceActions({
  busy,
  current,
  onMark,
}: {
  readonly busy: boolean;
  readonly current: string | null | undefined;
  readonly onMark: (status: "present" | "absent") => void;
}) {
  const t = useTranslations("tours.workspace.operations");
  return (
    <div className="flex flex-wrap gap-2" data-testid="ito-attendance-actions">
      <Button
        type="button"
        size="sm"
        variant={current === "present" ? "default" : "outline"}
        data-testid="ito-mark-present"
        disabled={busy || current === "present"}
        onClick={() => onMark("present")}
      >
        {t("markPresent")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={current === "absent" ? "default" : "outline"}
        data-testid="ito-mark-absent"
        disabled={busy || current === "absent"}
        onClick={() => onMark("absent")}
      >
        {t("markAbsent")}
      </Button>
    </div>
  );
}
