"use client";

type SessionActivity = {
  uploads: number;
  saving: boolean;
  readonly listeners: Set<() => void>;
};

const sessions = new Map<string, SessionActivity>();

function activityFor(sessionId: string): SessionActivity {
  let activity = sessions.get(sessionId);
  if (activity === undefined) {
    activity = { uploads: 0, saving: false, listeners: new Set() };
    sessions.set(sessionId, activity);
  }
  return activity;
}

function removeWhenIdle(sessionId: string, activity: SessionActivity): void {
  if (activity.uploads === 0 && !activity.saving && activity.listeners.size === 0) {
    sessions.delete(sessionId);
  }
}

function releaseOnce(release: () => void): () => void {
  let released = false;
  return () => {
    if (!released) {
      released = true;
      release();
    }
  };
}

/** Completion includes applying the uploaded storage pointer to the current draft. */
export function beginDenaliPhotoUpload(sessionId: string): (() => void) | null {
  const activity = activityFor(sessionId);
  if (activity.saving) return null;
  activity.uploads += 1;
  if (activity.uploads === 1) activity.listeners.forEach((listen) => listen());
  return releaseOnce(() => {
    activity.uploads -= 1;
    if (activity.uploads === 0) activity.listeners.forEach((listen) => listen());
    removeWhenIdle(sessionId, activity);
  });
}

export function beginDenaliExistingTourSave(sessionId: string): (() => void) | null {
  const activity = activityFor(sessionId);
  if (activity.saving || activity.uploads > 0) return null;
  activity.saving = true;
  return releaseOnce(() => {
    activity.saving = false;
    removeWhenIdle(sessionId, activity);
  });
}

export function denaliPhotoUploadPending(sessionId: string): boolean {
  return (sessions.get(sessionId)?.uploads ?? 0) > 0;
}

export function subscribeDenaliPhotoUploadPending(
  sessionId: string,
  listener: () => void
): () => void {
  const activity = activityFor(sessionId);
  activity.listeners.add(listener);
  return releaseOnce(() => {
    activity.listeners.delete(listener);
    removeWhenIdle(sessionId, activity);
  });
}
