"use client";

import { useEffect, useMemo, useState } from "react";

import type { LeaderRegistrationRow } from "@/lib/hooks/useLeaderTourRegistrations";
import type {
  QueueFilter,
  ReviewFiltersState,
  ReviewOverview,
  ReviewStatusFilter,
} from "@/features/leader-review/types";

function toStartOfDayMs(raw: string): number | null {
  if (!raw.trim()) return null;
  const ms = Date.parse(`${raw}T00:00:00`);
  return Number.isFinite(ms) ? ms : null;
}

function toEndOfDayMs(raw: string): number | null {
  if (!raw.trim()) return null;
  const ms = Date.parse(`${raw}T23:59:59.999`);
  return Number.isFinite(ms) ? ms : null;
}

export function useLeaderReviewFilters(rows: LeaderRegistrationRow[], pendingRows: LeaderRegistrationRow[]) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("pending");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("all");
  const [participantFilter, setParticipantFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRegistrationId) return;
    if (rows.some((row) => row.id === selectedRegistrationId)) return;
    setSelectedRegistrationId(null);
  }, [rows, selectedRegistrationId]);

  const visibleRows = useMemo(() => {
    const base = queueFilter === "pending" ? pendingRows : rows;
    const query = participantFilter.trim().toLowerCase();
    const fromMs = toStartOfDayMs(fromDate);
    const toMs = toEndOfDayMs(toDate);

    return [...base]
      .filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (query) {
          const hay = `${row.participantFullName} ${row.participantContactPhone}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        const updatedMs = Date.parse(row.updatedAt);
        if (Number.isFinite(updatedMs)) {
          if (fromMs != null && updatedMs < fromMs) return false;
          if (toMs != null && updatedMs > toMs) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, pendingRows, queueFilter, statusFilter, participantFilter, fromDate, toDate]);

  const overview: ReviewOverview = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((row) => row.status === "Pending").length;
    const approved = rows.filter((row) => row.status === "Accepted" || row.status === "AcceptedPaid").length;
    const rejected = rows.filter((row) => row.status === "Rejected" || row.status === "Cancelled").length;
    return { total, pending, approved, rejected };
  }, [rows]);

  const selectedRegistration = useMemo(
    () => visibleRows.find((row) => row.id === selectedRegistrationId) ?? null,
    [selectedRegistrationId, visibleRows],
  );

  const filtersState: ReviewFiltersState = {
    queueFilter,
    statusFilter,
    participantFilter,
    fromDate,
    toDate,
  };

  const clearFilters = () => {
    setQueueFilter("pending");
    setStatusFilter("all");
    setParticipantFilter("");
    setFromDate("");
    setToDate("");
  };

  return {
    queueFilter,
    statusFilter,
    participantFilter,
    fromDate,
    toDate,
    selectedRegistrationId,
    setQueueFilter,
    setStatusFilter,
    setParticipantFilter,
    setFromDate,
    setToDate,
    setSelectedRegistrationId,
    clearFilters,
    filtersState,
    visibleRows,
    overview,
    selectedRegistration,
  };
}
