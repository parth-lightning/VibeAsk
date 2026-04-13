import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getKnowledgeGaps,
  getKnowledgeGapStats,
} from "@/app/actions/get-knowledge-gaps";
import {
  KnowledgeGapsTable,
  KnowledgeGapsTableSkeleton,
} from "@/components/knowledge-gaps-table";
import { CircleDashed, Sparkles, Calendar } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
}

// Stats cards component
async function StatsCards() {
  const stats = await getKnowledgeGapStats();

  if (stats.error) {
    return null;
  }

  const cards = [
    {
      title: "Unanswered",
      value: stats.unanswered,
      icon: CircleDashed,
      className: "text-yellow-600",
      bgClassName: "bg-yellow-50",
    },
    {
      title: "This Week",
      value: stats.thisWeek,
      icon: Calendar,
      className: "text-blue-600",
      bgClassName: "bg-blue-50",
    },
    {
      title: "Cascaded",
      value: stats.cascaded,
      icon: Sparkles,
      className: "text-green-600",
      bgClassName: "bg-green-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`rounded-full p-2 ${card.bgClassName}`}>
              <card.icon className={`h-4 w-4 ${card.className}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Table content component
async function KnowledgeGapsContent({
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
    | "unanswered"
    | "answered"
    | "cascaded";
  const search = searchParams.search || "";

  const { gaps, total, error } = await getKnowledgeGaps({
    page,
    pageSize: 10,
    status,
    search,
  });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error loading knowledge gaps: {error}</p>
      </div>
    );
  }

  return (
    <KnowledgeGapsTable
      gaps={gaps}
      total={total}
      currentPage={page}
      pageSize={10}
    />
  );
}

export default async function KnowledgeGapsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;

  return (
    <div className="p-6 pr-8 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Gaps</h1>
        <p className="text-muted-foreground">
          Questions users asked that weren&apos;t in your knowledge base. Answer
          them to improve your chatbot.
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-12 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <StatsCards />
      </Suspense>

      {/* Table with suspense */}
      <Suspense fallback={<KnowledgeGapsTableSkeleton />}>
        <KnowledgeGapsContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
