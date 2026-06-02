import type { ReactNode } from "react";

import { SettingsSubnav } from "./settings-subnav";

export default function SettingsSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SettingsSubnav />
      {children}
    </>
  );
}
