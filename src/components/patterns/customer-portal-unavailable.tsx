import { Mascot } from "@/components/patterns/mascot";

/** Nøytral side mens kundeportalen bygges på ekte data. Ingen innlogging, ingen lenker inn i appen. */
export function CustomerPortalUnavailable() {
  return (
    <main className="light flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Mascot state="idle" size={72} />
      <h1 className="text-xl font-semibold text-foreground">Kundeportalen er ikke tilgjengelig ennå</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Har du spørsmål om rapporten din, ta kontakt med kontaktpersonen din i AB Marketing.
      </p>
    </main>
  );
}
