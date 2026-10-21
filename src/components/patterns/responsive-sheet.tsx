"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePhone } from "@/lib/use-media-query";

/**
 * One container for a form or a decision: a centred dialog on desktop, a bottom sheet
 * on a phone (IFK-08, 08-DESIGN-REVIEW «bottom-sheet for forms on phone»).
 *
 * The bottom sheet keeps the primary action within reach of the thumb: the footer is
 * sticky at the bottom of the sheet and the sheet caps at 90 % of the viewport so the
 * page behind is still visible above it. Focus trap and return come from Radix in both.
 *
 *     <ResponsiveSheet open={open} onOpenChange={setOpen} title="Gi tilgang"
 *       description="Gjelder bare denne personen." footer={<Button>Lagre</Button>}>
 *       …fields…
 *     </ResponsiveSheet>
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const phone = usePhone();
  if (phone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] gap-0 rounded-t-2xl p-0">
          {/* The grab handle tells a touch user the sheet can be dismissed by dragging down. */}
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="px-4 pt-3 text-left">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
          {footer && (
            <SheetFooter className="sticky bottom-0 gap-2 border-t border-border bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [&_button]:min-h-11">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
