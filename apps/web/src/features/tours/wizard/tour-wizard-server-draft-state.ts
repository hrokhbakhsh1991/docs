/** Last known server row version for optimistic PATCH (per tab). */
let serverDraftRowVersion: number | undefined;

export function getServerDraftRowVersion(): number | undefined {
  return serverDraftRowVersion;
}

export function setServerDraftRowVersion(version: number | undefined): void {
  serverDraftRowVersion = version;
}
