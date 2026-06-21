"use client";

import React from "react";

type PlatformCompositeFallbackProps = {
  readonly compositeId: string;
};

export function PlatformCompositeFallback({ compositeId }: PlatformCompositeFallbackProps) {
  return (
    <div
      className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
      data-composite-fallback=""
      data-composite-id={compositeId}
    >
      Unsupported composite: {compositeId}
    </div>
  );
}
