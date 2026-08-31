/** Module-level tracker for in-flight Denali wizard photo uploads (create + flat edit). */

let activeUploadCount = 0;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Call when a photo file upload starts; invoke returned disposer when it finishes. */
export function trackDenaliPhotoUploadLifecycle(): () => void {
  activeUploadCount += 1;
  notifyListeners();
  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    notifyListeners();
  };
}

export function getDenaliActivePhotoUploadCount(): number {
  return activeUploadCount;
}

export function subscribeDenaliPhotoUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function assertDenaliPhotoUploadsIdle(): string | null {
  return activeUploadCount > 0 ? "PHOTO_UPLOAD_IN_PROGRESS" : null;
}

/** Test-only reset — do not use in production UI. */
export function resetDenaliPhotoUploadTrackerForTests(): void {
  activeUploadCount = 0;
  notifyListeners();
}
