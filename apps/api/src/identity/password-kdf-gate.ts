export class PasswordKdfBusyError extends Error {
  readonly code = "PASSWORD_KDF_BUSY";
  constructor() {
    super("PASSWORD_KDF_BUSY");
    this.name = "PasswordKdfBusyError";
  }
}

/** Bounded process-local protection against expensive KDF work overwhelming RAM. */
export class PasswordKdfGate {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(
    private readonly maxActive: number,
    private readonly maxWaiting: number
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxActive) {
      if (this.waiters.length >= this.maxWaiting) throw new PasswordKdfBusyError();
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await work();
    } finally {
      const next = this.waiters.shift();
      if (next !== undefined) next();
      else this.active -= 1;
    }
  }
}
