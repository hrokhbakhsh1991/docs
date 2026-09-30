/**
 * Coordinates booking mutations that must not interleave in the same runtime.
 * The storage composition supplies the implementation; the application service
 * only depends on this port and never on a repository adapter.
 */
export interface BookingSerialMutationPort {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
