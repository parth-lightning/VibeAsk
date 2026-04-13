"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Mail,
  Clock,
  MessageSquare,
  Bot,
  CheckCircle,
  CircleDashed,
  ArrowRight,
  Lightbulb,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeGap } from "@/app/actions/get-knowledge-gaps";
import { answerKnowledgeGap } from "@/app/actions/answer-knowledge-gap";

interface KnowledgeGapsTableProps {
  gaps: KnowledgeGap[];
  total: number;
  currentPage: number;
  pageSize: number;
}

// Status config
const statusConfig = {
  unanswered: {
    label: "Unanswered",
    icon: CircleDashed,
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    description: "Awaiting admin answer",
  },
  answered: {
    label: "Answered",
    icon: ArrowRight,
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    description: "Answer provided, cascading...",
  },
  cascaded: {
    label: "Cascaded",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    description: "Added to knowledge base",
  },
};

// Get status from gap
function getGapStatus(
  gap: KnowledgeGap
): "unanswered" | "answered" | "cascaded" {
  if (gap.cascaded_at) return "cascaded";
  if (gap.answer) return "answered";
  return "unanswered";
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Format full date time
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Detail Item Component for Drawer
function DetailItem({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

export function KnowledgeGapsTable({
  gaps,
  total,
  currentPage,
  pageSize,
}: KnowledgeGapsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Drawer state
  const [selectedGap, setSelectedGap] = useState<KnowledgeGap | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || ""
  );

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);

  // Update URL params
  const updateParams = (updates: Record<string, string | null>) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Reset to page 1 when filters change (except for page changes)
      if (!("page" in updates)) {
        params.delete("page");
      }

      router.push(`/dashboard/knowledge-gaps?${params.toString()}`);
    });
  };

  // Handle search
  const handleSearch = () => {
    updateParams({ search: searchValue });
  };

  // Handle row click
  const handleRowClick = (gap: KnowledgeGap) => {
    setSelectedGap(gap);
    setAnswer(gap.answer || "");
    setIsDrawerOpen(true);
  };

  // Handle submit answer
  const handleSubmitAnswer = async () => {
    if (!selectedGap || !answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await answerKnowledgeGap({
        id: selectedGap.id,
        answer: answer.trim(),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        "Answer submitted successfully! It will be added to the knowledge base and the user will be notified via email."
      );
      setIsDrawerOpen(false);
      setSelectedGap(null);
      setAnswer("");
    } catch (error) {
      toast.error("Failed to submit answer");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions or AI comments..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 pr-9"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue("");
                updateParams({ search: null });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(value) => updateParams({ status: value })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unanswered">Unanswered</SelectItem>
            <SelectItem value="answered">Answered</SelectItem>
            <SelectItem value="cascaded">Cascaded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Question</TableHead>
              <TableHead className="w-[30%]">AI Comment</TableHead>
              <TableHead className="w-[15%]">User Email</TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-[8%] text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gaps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Lightbulb className="h-8 w-8" />
                    <p>No knowledge gaps found</p>
                    <p className="text-sm">
                      When users ask questions not in your knowledge base,
                      they&apos;ll appear here.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              gaps.map((gap) => {
                const status = getGapStatus(gap);
                const config = statusConfig[status];
                const StatusIcon = config.icon;

                return (
                  <TableRow
                    key={gap.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(gap)}
                  >
                    <TableCell className="font-medium">
                      <div className="text-sm max-w-md truncate">
                        {truncate(gap.query, 80)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="text-sm max-w-xs truncate">
                        {truncate(gap.ai_comment, 60)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {gap.user_email ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {gap.user_email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${config.className} text-xs`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                      {formatRelativeTime(gap.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, total)} of {total} gaps
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              disabled={currentPage >= totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <div className="mx-auto w-full max-w-2xl overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                {selectedGap?.answer
                  ? "View Knowledge Gap"
                  : "Answer Knowledge Gap"}
              </DrawerTitle>
              <DrawerDescription>
                {selectedGap?.answer
                  ? "This question has been answered and added to the knowledge base."
                  : "Provide an answer to add this to your knowledge base."}
              </DrawerDescription>
            </DrawerHeader>

            {selectedGap && (
              <div className="px-4 pb-4 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const status = getGapStatus(selectedGap);
                    const config = statusConfig[status];
                    const StatusIcon = config.icon;
                    return (
                      <Badge variant="outline" className={config.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-sm text-muted-foreground">
                    {formatDateTime(selectedGap.created_at)}
                  </span>
                </div>

                {/* User Question */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    User&apos;s Question
                  </Label>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm">{selectedGap.query}</p>
                  </div>
                </div>

                {/* AI Comment */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Bot className="h-4 w-4" />
                    AI&apos;s Comment
                  </Label>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <p className="text-sm text-blue-900">
                      {selectedGap.ai_comment}
                    </p>
                  </div>
                </div>

                {/* User Email */}
                {selectedGap.user_email && (
                  <DetailItem
                    icon={Mail}
                    label="User Email"
                    value={selectedGap.user_email}
                  />
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem
                    icon={Clock}
                    label="Asked"
                    value={formatDateTime(selectedGap.created_at)}
                  />
                  {selectedGap.answered_at && (
                    <DetailItem
                      icon={CheckCircle}
                      label="Answered"
                      value={formatDateTime(selectedGap.answered_at)}
                    />
                  )}
                </div>

                {/* Answer Section */}
                {selectedGap.answer ? (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Your Answer
                    </Label>
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <p className="text-sm text-green-900">
                        {selectedGap.answer}
                      </p>
                    </div>
                    {selectedGap.cascaded_at && (
                      <Alert className="bg-green-50 border-green-200">
                        <Sparkles className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          This Q&A has been added to your knowledge base and the
                          user was notified via email.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label
                      htmlFor="answer"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Send className="h-4 w-4" />
                      Your Answer
                    </Label>
                    <Textarea
                      id="answer"
                      placeholder="Type your answer here..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <Alert>
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription>
                        When you submit, this answer will be automatically added
                        to your knowledge base
                        {selectedGap.user_email &&
                          " and the user will be notified via email"}
                        .
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            )}

            <DrawerFooter>
              {selectedGap && !selectedGap.answer && (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitting || !answer.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Answer
                    </>
                  )}
                </Button>
              )}
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Loading skeleton
export function KnowledgeGapsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-[180px]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Question</TableHead>
              <TableHead className="w-[30%]">AI Comment</TableHead>
              <TableHead>User Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-[80%]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[70%]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-24" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-4 w-16 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
