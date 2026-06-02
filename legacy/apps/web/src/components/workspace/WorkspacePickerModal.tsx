"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button, EmptyState, ErrorState, LoadingState, Modal } from "@tour/ui";

import { resolveAuthUiErrorMessage } from "@/lib/errors/auth-ui-error-message";
import {
  getAuthWorkspaces,
  type AuthWorkspaceListItem
} from "@/lib/services/auth-workspaces.service";

import styles from "./WorkspacePickerModal.module.css";

export type WorkspacePickerItem = AuthWorkspaceListItem;

export type WorkspacePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (_workspace: WorkspacePickerItem) => void;
  title?: ReactNode;
  /**
   * When set, skips GET /api/v2/auth/workspaces (caller already loaded rows).
   * Use after login to avoid a duplicate fetch while opening the picker.
   */
  prefetchedWorkspaces?: WorkspacePickerItem[];
};

const DEFAULT_TITLE = "Choose workspace";

function resolveWorkspaceFetchError(error: unknown): string {
  return resolveAuthUiErrorMessage(error);
}

export function WorkspacePickerModal({
  open,
  onClose,
  onSelect,
  title = DEFAULT_TITLE,
  prefetchedWorkspaces
}: WorkspacePickerModalProps): JSX.Element {
  const [workspaces, setWorkspaces] = useState<WorkspacePickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const fetchWorkspaces = useCallback(async () => {
    const id = ++requestSeq.current;
    setLoading(true);
    setErrorMessage(null);
    try {
      const rows = await getAuthWorkspaces();
      if (id !== requestSeq.current) {
        return;
      }
      setWorkspaces(rows);
    } catch (e) {
      if (id !== requestSeq.current) {
        return;
      }
      setWorkspaces([]);
      setErrorMessage(resolveWorkspaceFetchError(e));
    } finally {
      if (id === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      requestSeq.current += 1;
      setWorkspaces([]);
      setErrorMessage(null);
      setLoading(false);
      return;
    }
    if (prefetchedWorkspaces !== undefined) {
      setWorkspaces(prefetchedWorkspaces);
      setErrorMessage(null);
      setLoading(false);
      return;
    }
    void fetchWorkspaces();
  }, [open, prefetchedWorkspaces, fetchWorkspaces]);

  const retryFetch = useCallback(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {loading ? (
        <div className={styles.statePanel}>
          <LoadingState message="Loading workspaces…" />
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className={styles.statePanel}>
          <ErrorState
            title="Workspaces unavailable"
            message={errorMessage}
            onRetry={retryFetch}
          />
        </div>
      ) : null}

      {!loading && !errorMessage && workspaces.length === 0 ? (
        <EmptyState
          className={styles.statePanel}
          embedded
          title="No workspaces"
          description="You have no tenant memberships to switch to."
        />
      ) : null}

      {!loading && !errorMessage && workspaces.length > 0 ? (
        <ul className={styles.list} aria-label="Workspaces">
          {workspaces.map((ws) => (
            <li key={ws.tenant_id}>
              <button
                type="button"
                className={styles.row}
                onClick={() => onSelect(ws)}
              >
                <span className={styles.rowInner}>
                  <span className={styles.tenantName}>{ws.tenant_name}</span>
                  <span className={styles.role}>{ws.role}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
