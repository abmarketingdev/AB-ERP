import { apiPost, API } from "./api/client";
import { auditEntrySchema, type AuditEntry } from "@/types/quality";

/**
 * Writes an audit entry through the API boundary.
 *
 * Previously this mutated the AUDIT_LOG fixture directly. Once Revisjonslogg
 * started reading from the mock store, that left two competing audit logs and
 * preview sessions silently stopped appearing — so it now goes through the same
 * endpoint as every other write. Fire-and-forget: an audit entry must never
 * block the action that produced it.
 */
export function logAudit(entry: Omit<AuditEntry, "id" | "at" | "ts"> & { at?: string; ts?: string }) {
  void apiPost(`${API.qc}/audit`, auditEntrySchema, entry).catch((err) => {
    console.error("[audit] could not write entry", err);
  });
}
