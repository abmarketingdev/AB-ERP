"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";

/**
 * The error summary a form shows on submit (08-DESIGN-REVIEW «an error summary on submit,
 * focus moves to the first error»). Each item links to its field, so a keyboard or
 * screen-reader user can jump straight there; the summary itself takes focus when it
 * appears so the failure is announced.
 *
 *     <FormErrorSummary errors={[{ field: "reason", message: "Begrunnelse må fylles ut." }]} />
 *
 * `field` is the input's id. A server-side 400 with `errors` maps onto the same shape
 * via `errorsFromApi()`.
 */
export interface FieldError {
  field?: string;
  message: string;
}

export function FormErrorSummary({ errors, title = "Skjemaet må rettes før det kan lagres" }: {
  errors: FieldError[];
  title?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const count = errors.length;
  React.useEffect(() => {
    if (count) ref.current?.focus();
  }, [count]);
  if (!count) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="flex items-center gap-2 font-medium text-danger">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-foreground">
        {errors.map((e, i) => (
          <li key={`${e.field ?? "x"}-${i}`}>
            {e.field ? (
              <a
                href={`#${e.field}`}
                className="underline underline-offset-2 hover:text-danger"
                onClick={(ev) => {
                  const el = document.getElementById(e.field!);
                  if (el) {
                    ev.preventDefault();
                    el.focus();
                    el.scrollIntoView({ block: "center" });
                  }
                }}
              >
                {e.message}
              </a>
            ) : (
              e.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** recruitment-service 400 body `{message, errors: {field: [msg]}}` → FieldError[]. */
export function errorsFromApi(body: unknown): FieldError[] {
  if (!body || typeof body !== "object") return [];
  const b = body as { message?: unknown; errors?: unknown };
  const out: FieldError[] = [];
  if (b.errors && typeof b.errors === "object") {
    for (const [field, msgs] of Object.entries(b.errors as Record<string, unknown>)) {
      const first = Array.isArray(msgs) ? msgs[0] : msgs;
      if (typeof first === "string") out.push({ field, message: first });
    }
  }
  if (!out.length && typeof b.message === "string") out.push({ message: b.message });
  return out;
}
