"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { MessageSquareOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/patterns/mascot";
import { MascotLoading } from "@/components/patterns/mascot-loading";
import { ConfirmStep } from "@/components/patterns/confirm-step";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useConfirmOptOut, useOptOutLink } from "@/lib/api/optout";
import { mascotFor } from "@/lib/use-mascot";

/**
 * «Avmeld SMS» — the page behind the link in every SMS (§8.1 l.743). A candidate on a
 * phone, no login: one sentence about what happens, one confirmation, a clear done state.
 * Shows only the masked number; never a name or what the messages were about.
 */
export default function AvmeldSms() {
  const { code } = useParams<{ code: string }>();
  const link = useOptOutLink(code);
  const confirm = useConfirmOptOut(code);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="mb-6 text-sm font-medium text-muted-foreground">AB Marketing</p>
        {link.isPending ? (
          <MascotLoading label="Henter lenken…" size={88} />
        ) : link.isError ? (
          <Problem error={link.error} onRetry={() => link.refetch()} />
        ) : link.data.optedOut ? (
          <Done masked={link.data.masked} already={link.data.already || !confirm.isSuccess} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquareOff className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <h1 className="text-xl font-medium">Meld av SMS</h1>
            </div>
            <p className="text-[15px] text-muted-foreground">
              Gjelder nummeret <span className="font-medium tabular-nums text-foreground">{link.data.masked}</span>.
            </p>
            <ConfirmStep
              tone="neutral"
              trigger="Meld meg av SMS"
              consequence="Du får ikke flere SMS fra oss. Et avtalt intervju gjelder fortsatt."
              confirmLabel="Ja, meld meg av"
              pending={confirm.isPending}
              onConfirm={() => confirm.mutate()}
            />
            {confirm.isError && <p role="alert" className="text-sm text-danger">{errorMessage(confirm.error)}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function Done({ masked, already }: { masked: string; already: boolean }) {
  const m = already ? mascotFor("allClear") : mascotFor("allDone");
  return (
    <div role="status" className="flex flex-col items-center gap-4 text-center">
      <Mascot {...m} size={96} />
      <h1 className="text-xl font-medium">{already ? "Du er allerede meldt av" : "Du er meldt av"}</h1>
      <p className="text-[15px] text-muted-foreground">
        Nummeret <span className="font-medium tabular-nums text-foreground">{masked}</span> får ikke flere SMS fra oss.
      </p>
    </div>
  );
}

function Problem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div role="alert" className="flex flex-col items-center gap-4 text-center">
      <Mascot {...mascotFor("error")} size={88} />
      <h1 className="text-xl font-medium">{notFound ? "Lenken virker ikke" : "Noe gikk galt"}</h1>
      <p className="text-[15px] text-muted-foreground">
        {notFound
          ? "Lenken er ugyldig eller utløpt. Du kan også svare STOPP på SMS-en for å melde deg av."
          : errorMessage(error)}
      </p>
      {!notFound && <Button className="min-h-11" onClick={onRetry}>Prøv igjen</Button>}
    </div>
  );
}
