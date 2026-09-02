"use client";

import type { OperatorSessionContext } from "@/admin/require-operator-session";

import { WalletOpsPanel } from "@/wallet/wallet-ops-panel";

type WalletOpsCenterProps = {
  readonly session: OperatorSessionContext;
};

export function WalletOpsCenter({ session }: WalletOpsCenterProps) {
  return <WalletOpsPanel session={session} />;
}
