/** Generic transition table — edges keyed by source status. */
export type TransitionTable<S extends string> = Readonly<
  Record<S, readonly S[]>
>;

export function isTerminalTransitionStatus<S extends string>(
  status: S,
  terminalStatuses: readonly S[],
): boolean {
  return (terminalStatuses as readonly string[]).includes(status);
}

export function canTransitionState<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
  terminalStatuses: readonly S[] = [],
): boolean {
  if (from === to) {
    return false;
  }
  if (isTerminalTransitionStatus(from, terminalStatuses)) {
    return false;
  }
  return table[from].includes(to);
}

export function listTransitionTargetsFrom<S extends string>(
  table: TransitionTable<S>,
  from: S,
): readonly S[] {
  return table[from];
}

export function listTransitionSourcesForTarget<S extends string>(
  table: TransitionTable<S>,
  to: S,
  allStatuses: readonly S[],
  terminalStatuses: readonly S[] = [],
): readonly S[] {
  const sources: S[] = [];
  for (const status of allStatuses) {
    if (canTransitionState(table, status, to, terminalStatuses)) {
      sources.push(status);
    }
  }
  return Object.freeze(sources);
}

export function assertCanTransitionState<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
  terminalStatuses: readonly S[] = [],
  errorMessage?: (from: S, to: S) => string,
): void {
  if (!canTransitionState(table, from, to, terminalStatuses)) {
    const message =
      errorMessage?.(from, to) ?? `TRANSITION_REJECTED: ${from} → ${to} is not allowed`;
    throw new Error(message);
  }
}
