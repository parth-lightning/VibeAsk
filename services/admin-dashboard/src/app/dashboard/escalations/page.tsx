import { Suspense } from "react";
import { getEscalations } from "@/app/actions/get-escalations";
import {
  EscalationsTable,
  EscalationsTableSkeleton,
} from "@/components/escalations-table";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
}

async function EscalationsContent({
  searchParams,
}: {
  searchParams: {
    page?: string;
    status?: string;
    search?: string;
  };
}) {
  const page = parseInt(searchParams.page || "1", 10);
  const status = (searchParams.status || "all") as
    | "all"
    | "pending"
    | "in_progress"
    | "resolved";
  const search = searchParams.search || "";

  const { escalations, total, error } = await getEscalations({
    page,
    pageSize: 10,
    status,
    search,
  });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error loading escalations: {error}</p>
      </div>
    );
  }

  return (
    <EscalationsTable
      escalations={escalations}
      total={total}
      currentPage={page}
      pageSize={10}
    />
  );
}

export default async function EscalationsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Human Escalations</h1>
        <p className="text-muted-foreground">
          Manage student escalation requests that require personal attention
        </p>
      </div>

      {/* Table with suspense */}
      <Suspense fallback={<EscalationsTableSkeleton />}>
        <EscalationsContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
