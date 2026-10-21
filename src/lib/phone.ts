/**
 * Norwegian phone numbers shown one way, however they were typed (LEAD-07 matches them
 * normalised; the screen should read the same): «+47 912 34 567» → «912 34 567».
 * Foreign numbers keep their country code; anything unparseable is shown as typed.
 */
export function formatPhone(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  let digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (/^\+47\d{8}$/.test(digits)) digits = digits.slice(3);
  else if (/^47\d{8}$/.test(digits)) digits = digits.slice(2);
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  return value;
}

/** «912 34 567 · kari@eksempel.no» without a dangling separator when one is missing. */
export function contactLine(phone: string | null | undefined, email: string | null | undefined): string {
  return [formatPhone(phone), (email ?? "").trim()].filter(Boolean).join(" · ");
}
