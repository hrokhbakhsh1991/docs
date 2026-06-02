import { isClientBlobUrl } from "./preserveDenaliWizardBlobMedia";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export type DenaliPhotoPersistenceIssue = {
  kind: "gallery" | "itinerary";
  day?: number;
  count: number;
};

export function collectDenaliUnpersistedPhotoBlobIssues(
  form: DenaliCreateTourWizardForm,
): DenaliPhotoPersistenceIssue[] {
  const issues: DenaliPhotoPersistenceIssue[] = [];

  const galleryBlobs = (form.photosData?.photos ?? []).filter((p) => isClientBlobUrl(p.url));
  if (galleryBlobs.length > 0) {
    issues.push({ kind: "gallery", count: galleryBlobs.length });
  }

  for (const row of form.programNature.itinerary ?? []) {
    const blobCount = (row.photos ?? []).filter((p) => isClientBlobUrl(p.url)).length;
    if (blobCount > 0) {
      issues.push({ kind: "itinerary", day: row.day, count: blobCount });
    }
  }

  return issues;
}

export function formatDenaliPhotoPersistenceWarning(
  issues: readonly DenaliPhotoPersistenceIssue[],
): string {
  if (issues.length === 0) {
    return "";
  }
  const parts: string[] = [];
  const gallery = issues.find((i) => i.kind === "gallery");
  if (gallery) {
    parts.push(
      `${gallery.count} عکس گالری هنوز آپلود نشده (لینک موقت blob در مرورگر ذخیره شده و در ثبت نهایی حذف می‌شود).`,
    );
  }
  const itinerary = issues.filter((i) => i.kind === "itinerary");
  if (itinerary.length > 0) {
    const total = itinerary.reduce((sum, row) => sum + row.count, 0);
    parts.push(`${total} عکس برنامه روزانه هنوز آپلود نشده است.`);
  }
  parts.push("لطفاً پس از اتمام آپلود دوباره ثبت کنید.");
  return parts.join(" ");
}

export function hasDenaliUnpersistedPhotoBlobs(form: DenaliCreateTourWizardForm): boolean {
  return collectDenaliUnpersistedPhotoBlobIssues(form).length > 0;
}
