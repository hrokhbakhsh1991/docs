import type { ReactNode } from "react";

import { Phase3ShellLayout } from "@/shell/phase3-shell-layout";

export default function Phase3RouteLayout({ children }: { children: ReactNode }) {
  return <Phase3ShellLayout>{children}</Phase3ShellLayout>;
}
