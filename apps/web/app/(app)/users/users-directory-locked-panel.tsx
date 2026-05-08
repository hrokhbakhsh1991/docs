"use client";

import { useRouter } from "next/navigation";

import { Button, Card, CardBody, EmptyState, ErrorState, LoadingState } from "@tour/ui";

import { LEADER_WORKSPACE_ACCESS_DENIED } from "@/lib/auth/auth-context";

import { USERS_ROUTE_COPY } from "./users-copy";
import type { UsersDirectoryBodyState } from "./users-directory-gate";
import { usersListErrorMessage, usersListErrorTitle } from "./users-directory-gate";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryLockedPanelProps = {
  state: Exclude<UsersDirectoryBodyState, { type: "directory" }>;
  onRetryList: () => void;
};

/** Gates before the member directory table: session, auth, role, API URL, load, error, empty roster. */
export function UsersDirectoryLockedPanel({ state, onRetryList }: UsersDirectoryLockedPanelProps) {
  const router = useRouter();

  switch (state.type) {
    case "hydrating-session":
      return (
        <Card>
          <CardBody>
            <LoadingState message={copy.loadingSession} />
          </CardBody>
        </Card>
      );
    case "sign-in":
      return (
        <Card>
          <CardBody>
            <EmptyState
              title={copy.signInTitle}
              description={copy.signInDescription}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      );
    case "leader-denied":
      return (
        <Card>
          <CardBody>
            <EmptyState
              title={LEADER_WORKSPACE_ACCESS_DENIED.title}
              description={LEADER_WORKSPACE_ACCESS_DENIED.description}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              }
            />
          </CardBody>
        </Card>
      );
    case "api-unavailable":
      return (
        <Card>
          <CardBody>
            <EmptyState title={copy.apiNotConfiguredTitle} description={copy.apiNotConfiguredDescription} />
          </CardBody>
        </Card>
      );
    case "list-loading":
      return (
        <Card>
          <CardBody>
            <LoadingState message={copy.loadingMembers} />
          </CardBody>
        </Card>
      );
    case "list-error":
      return (
        <Card>
          <CardBody>
            <ErrorState
              title={usersListErrorTitle(state.error)}
              message={usersListErrorMessage(state.error)}
              onRetry={onRetryList}
            />
          </CardBody>
        </Card>
      );
    case "list-empty":
      return (
        <Card>
          <CardBody>
            <EmptyState title={copy.emptyListTitle} description={copy.emptyListDescription} />
          </CardBody>
        </Card>
      );
  }
}
