import type { InsertDraftEventInput } from "../../draft-event.types";

export const DRAFT_EVENTS_PORT = Symbol("DRAFT_EVENTS_PORT");

export interface DraftEventsPort {
  insert(input: InsertDraftEventInput): Promise<unknown>;
}
