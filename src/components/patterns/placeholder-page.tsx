import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title={title} />
      <EmptyState title="Under bygging" description="Denne skjermen kommer i neste fase." pose="building" />
    </div>
  );
}
