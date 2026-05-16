"use client";

import { useEffect, useState } from "react";

/** True only after the client has committed (skips Next.js link-prefetch passes). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
