import { formatDate, formatDateTime } from "@/lib/format";

/**
 * The recruitment API sends ISO timestamps; the mock sends display strings («18. aug 2026»).
 * Format what parses as ISO, show anything else as is, and render nothing for empty —
 * a raw «2026-10-21T19:34:44.359342+00:00» or «Invalid Date» must never reach the screen.
 */
export function showDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(new Date(value).getTime())) return value;
  return withTime && value.length > 10 ? formatDateTime(value) : formatDate(value);
}
