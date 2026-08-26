"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

type SheetSide = "top" | "right" | "bottom" | "left";
type SheetEnterFrom = SheetSide;

function resolveSheetEnterFrom(side: SheetSide): SheetEnterFrom {
  return side;
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> & {
    readonly variant?: "default" | "detail";
  }
>(({ className, variant = "default", ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-operator-sheet-overlay=""
    data-operator-sheet-variant={variant}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 motion-reduce:animate-none",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: SheetSide;
    /** Operator member detail — softer overlay + slower slide (reduced-motion respected). */
    detailSheet?: boolean;
  }
>(({ side = "right", className, children, detailSheet = false, ...props }, ref) => {
  const enterFrom = resolveSheetEnterFrom(side);

  return (
    <SheetPortal>
      <SheetOverlay
        variant={detailSheet ? "detail" : "default"}
        className={detailSheet ? "bg-black/60" : undefined}
      />
      <SheetPrimitive.Content
        ref={ref}
        data-operator-sheet-panel=""
        data-operator-sheet-side={side}
        data-operator-sheet-enter-from={enterFrom}
        data-operator-detail-sheet={detailSheet ? "true" : undefined}
        className={cn(
          "fixed z-50 gap-4 bg-background p-6 shadow-lg motion-reduce:animate-none",
          side === "left" && "h-full w-3/4 sm:max-w-sm",
          side === "right" && "h-full w-3/4 sm:max-w-sm",
          side === "bottom" && "mt-24 h-auto max-h-[90vh] w-full",
          side === "top" && "mb-24 h-auto max-h-[90vh] w-full",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            "absolute top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
            side === "left" ? "right-4" : side === "right" ? "left-4" : "right-4"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetPortal,
  SheetOverlay,
};
