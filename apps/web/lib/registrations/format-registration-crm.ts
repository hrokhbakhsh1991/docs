import type { BookingDto } from "@repo/types";

const NOTE_PREVIEW_MAX = 80;

export function formatTransportModeFa(mode: BookingDto["transportMode"]): string {
  switch (mode) {
    case "self_vehicle":
      return "خودروی شخصی";
    case "group_vehicle":
      return "خودروی همسفران/گروهی";
    case "other":
      return "سایر";
    default:
      return mode;
  }
}

export function formatVehicleSeatBadgeFa(capacity: number | null | undefined): string | null {
  if (typeof capacity !== "number" || !Number.isFinite(capacity) || capacity < 1) {
    return null;
  }
  return `${Math.round(capacity)} صندلی اضافه`;
}

export function truncateParticipantNote(note: string | null | undefined, max = NOTE_PREVIEW_MAX): string | null {
  const t = note?.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export type RegistrationCrmSummary = {
  transportLabel: string;
  seatBadge: string | null;
  notePreview: string | null;
  noteFull: string | null;
};

export function formatRegistrationCrmSummary(
  reg: Pick<BookingDto, "transportMode" | "vehicleSeatCapacity" | "participantNote">,
): RegistrationCrmSummary {
  const noteFull = reg.participantNote?.trim() || null;
  return {
    transportLabel: formatTransportModeFa(reg.transportMode),
    seatBadge: formatVehicleSeatBadgeFa(reg.vehicleSeatCapacity),
    notePreview: truncateParticipantNote(noteFull),
    noteFull,
  };
}

export function formatRegistrationInstantFa(iso: string): string {
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
}
