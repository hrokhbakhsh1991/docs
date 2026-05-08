/**
 * Product-facing copy for `/users` (list + detail). Keeps titles, empty states,
 * and actions aligned with workspace member management language.
 */

export const USERS_ROUTE_COPY = {
  list: {
    documentTitle: "Users",
    pageTitle: "Users",
    pageDescription:
      "People in this workspace and their roles. Changes apply only to this workspace.",
    breadcrumbUsers: "Users",
    loadingSession: "Loading your session…",
    loadingMembers: "Loading members…",
    signInTitle: "Sign in required",
    signInDescription:
      "Your session expired or you’re signed out. Sign in to continue.",
    apiNotConfiguredTitle: "Workspace not connected",
    apiNotConfiguredDescription:
      "This app isn’t linked to your workspace yet. Ask your administrator to finish setup so you can manage members.",
    loadErrorTitle: "Could not load members",
    /** ErrorState title when the server denies access (403). */
    loadErrorAccessTitle: "Access restricted",
    loadErrorFallback: "We could not load the member list.",
    loadError403: "You don’t have permission to view members in this workspace.",
    emptyListTitle: "No members yet",
    /** Honest copy only—no CTA until invite flow exists (see users-directory-locked-panel). */
    emptyListDescription:
      "When people join this workspace, they’ll show up here. Inviting members directly from this page isn’t available yet.",
    roleUpdatedToast: "Role updated.",
    roleUpdateErrorToast: "Could not update the role.",
    searchLabel: "Search",
    searchHint: "Name or email",
    searchPlaceholder: "Search by name or email…",
    filterRoleLabel: "Role",
    /** Shown under role filter; complements visible label (avoid duplicate aria-label on `<Select>`). */
    filterRoleDescription: "Narrow the list by assigned role.",
    /** Groups search + role filter for assistive tech (toolbar region). */
    membersToolbarAriaLabel: "Search and filter members",
    tableAriaLabel: "Workspace members",
    columnActions: "Actions",
    profileButton: "Profile",
    /** Pagination region + buttons (members directory only). */
    paginationNavAriaLabel: "Workspace members list pagination",
    paginationPrevAriaLabel: "Go to previous page of members",
    paginationNextAriaLabel: "Go to next page of members",
    noResultsTitle: "No matches",
    noResultsDescription: "Try another search or change the role filter.",
    clearFiltersButton: "Clear filters",
    /** Role `<Select>` row hints — mirror UI-only; enforcement stays on the server. */
    roleSelectHintSelf: "You can’t change your own role here.",
    roleSelectHintOwnerTarget: "Workspace owners can’t be edited here.",
    roleSelectHintUnknownRole:
      "This membership uses a role that can’t be edited from this list. Refresh if this looks wrong.",
    roleSelectHintInsufficientRank:
      "You can’t change roles for people at or above your access level.",
    roleSelectHintNoAlternative: "No other role is available for this member with your access.",
    roleSelectHintSaving: "Saving role…",
    deleteUserButton: "Delete",
    deleteUserUnavailableHint: "Deleting users from this page is not available yet.",
    bulkActionsAriaLabel: "Bulk actions for selected users",
    bulkSelectedCountSuffix: "users selected",
    bulkChangeRoleLabel: "Change role",
    bulkChangeRoleAriaLabel: "Change role for selected users",
    bulkChangeRolePlaceholder: "Select role",
    bulkClearSelectionButton: "Clear selection",
    bulkApplyRoleButton: "Apply",
    refreshingLabel: "Refreshing…",
    loadingMoreUsersLabel: "Loading more users…",
  },
  detail: {
    loadingDocumentTitle: "Member profile",
    loadingTitle: "Member profile",
    loadingSession: "Loading your session…",
    loadingProfile: "Loading profile…",
    signInTitle: "Sign in required",
    signInDescription:
      "Your session expired or you’re signed out. Sign in to continue.",
    loadErrorTitle: "Could not load this profile",
    loadErrorAccessTitle: "Access restricted",
    loadError403:
      "You don’t have permission to view this profile in this workspace.",
    loadErrorFallback: "We could not load this profile.",
    notFoundTitle: "Member not found",
    notFoundMessage: "We could not find anyone with this profile in your workspace.",
    cardTitle: "Profile",
    backToUsers: "Back to users",
    roleHistoryTitle: "Role history",
    roleHistoryLoading: "Loading role history…",
    roleHistoryLoadErrorTitle: "Could not load role history",
    roleHistoryLoadErrorFallback: "Please try again.",
    roleHistoryEmptyTitle: "No role changes yet",
    roleHistoryEmptyDescription: "Recent role changes will appear here.",
    roleHistoryTableAriaLabel: "Role history",
    roleHistoryColumnActor: "Actor",
    roleHistoryColumnOldRole: "Old role",
    roleHistoryColumnNewRole: "New role",
    roleHistoryColumnTime: "Time",
    roleHistoryJustNow: "just now",
  },
  metadata: {
    listTitle: "Users",
    listDescription: "People and roles in your workspace.",
    detailTitle: "Member profile",
    detailDescription: "Member details for this workspace.",
  },
} as const;
