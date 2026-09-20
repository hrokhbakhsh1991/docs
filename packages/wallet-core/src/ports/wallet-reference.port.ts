import type { WalletResult } from "../domain/errors";
import type { WalletReference } from "../domain/types";

export interface WalletReferencePort {
  validateReference(reference: WalletReference): Promise<WalletResult<void>>;
}
