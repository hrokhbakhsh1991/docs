"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  resolveWorkspaceDraftEventMessageKey,
  shouldShowWorkspaceDraftEventsTimeline,
  sliceWorkspaceDraftEventsForDisplay,
} from "./workspace-draft-events-logic";
import type { WorkspaceDraftEventListItem } from "./workspace-draft-types";

export const WORKSPACE_DRAFT_EVENTS_TEST_IDS = {
  timeline: "workspace-draft-events-timeline",
  list: "workspace-draft-events-list",
} as const;

type WorkspaceDraftEventsTimelineProps = {
  readonly items: readonly WorkspaceDraftEventListItem[];
  readonly loading?: boolean;
};

export function WorkspaceDraftEventsTimeline({
  items,
  loading = false,
}: WorkspaceDraftEventsTimelineProps) {
  const t = useTranslations("wizard.host.draftEvents");
  const format = useFormatter();

  if (!shouldShowWorkspaceDraftEventsTimeline(loading, items)) {
    return null;
  }

  const visible = sliceWorkspaceDraftEventsForDisplay(items);

  return (
    <details
      className="workspace-draft-events-timeline"
      data-testid={WORKSPACE_DRAFT_EVENTS_TEST_IDS.timeline}
    >
      <summary>{t("title")}</summary>
      <ol
        className="workspace-draft-events-timeline__list"
        data-testid={WORKSPACE_DRAFT_EVENTS_TEST_IDS.list}
      >
        {visible.map((event) => (
          <li key={event.id} data-workspace-draft-event-action={event.action}>
            <span className="workspace-draft-events-timeline__action">
              {t(resolveWorkspaceDraftEventMessageKey(event.action))}
            </span>
            {event.version != null ? (
              <span className="workspace-draft-events-timeline__version">v{event.version}</span>
            ) : null}
            <time className="workspace-draft-events-timeline__time" dateTime={event.occurredAt}>
              {format.dateTime(new Date(event.occurredAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </li>
        ))}
      </ol>
    </details>
  );
}
