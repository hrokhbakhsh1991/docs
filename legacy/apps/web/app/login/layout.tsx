import type { ReactNode } from "react";

import AuthSegmentLayout from "../auth/layout";

export default function LoginRouteLayout({ children }: { children: ReactNode }) {
  return <AuthSegmentLayout>{children}</AuthSegmentLayout>;
}
