"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreview, endPreview } from "@/lib/preview";
import { logAudit } from "@/lib/audit";

/**
 * FR-A-05 — the banner that must be unmistakable throughout a preview session.
 *
 * It sits above everything, in every portal including the customer one, and it
 * carries the exit. An admin who forgets they are previewing and reads a
 * customer's report as if it were the internal one will draw a conclusion from
 * a deliberately narrower set of numbers — so the cost of missing this banner
 * is a wrong decision, not just confusion.
 */
export function PreviewBanner() {
  const preview = usePreview();
  const router = useRouter();

  return (
    <AnimatePresence>
      {preview && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="sticky top-0 z-50 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2 text-warning-foreground shadow-md">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Eye className="size-4" />
              Forhåndsviser som {preview.label} — ingen handlinger her er ekte
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 border-warning-foreground/30 bg-transparent text-warning-foreground hover:bg-warning-foreground/10"
              onClick={() => {
                logAudit({
                  actor: "Admin Bruker",
                  action: "Avsluttet forhåndsvisning",
                  area: "Forhåndsvis som",
                  affected: preview.label,
                  at: new Date().toLocaleString("nb-NO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
                });
                endPreview();
                router.replace("/admin/forhandsvis");
              }}
            >
              <X className="size-3.5" /> Avslutt forhåndsvisning
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
