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
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Wallet,
  AlertTriangle,
  Search,
  X,
  Phone,
  Mail,
  Clock,
  MessageSquare,
  Bot,
  CheckCircle,
  Calendar,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { Escalation } from "@/app/actions/get-escalations";
import { updateEscalation } from "@/app/actions/update-escalation";

interface EscalationsTableProps {
  escalations: Escalation[];
  total: number;
  currentPage: number;
  pageSize: number;
}

// Category config with descriptions
const categoryConfig = {
  admission_dispute: {
    label: "Admission Dispute",
    shortLabel: "Admission",
    icon: GraduationCap,
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    description:
      "Issues related to admission process, eligibility, or documentation",
  },
  financial_hardship: {
    label: "Financial Hardship",
    shortLabel: "Financial",
    icon: Wallet,
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    description:
      "Requests for fee waivers, payment extensions, or financial assistance",
  },
  grievance: {
    label: "Grievance",
    shortLabel: "Grievance",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-800 hover:bg-red-100",
    description:
      "Complaints about harassment, discrimination, or unfair treatment",
  },
};

// Status config
const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    description: "Awaiting admin review",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    description: "Being handled by admin",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
    description: "Issue has been resolved",
  },
};

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
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="mt-0.5 p-2 rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// Escalation Detail Drawer Component
function EscalationDrawer({
  escalation,
  open,
  onOpenChange,
  onUpdate,
}: {
  escalation: Escalation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updated: Escalation) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editedStatus, setEditedStatus] = useState<Escalation["status"] | null>(
    null
  );
  const [editedCategory, setEditedCategory] = useState<
    Escalation["category"] | null
  >(null);
  const [adminResponse, setAdminResponse] = useState<string>("");

  // Reset form when escalation changes
  const resetForm = () => {
    if (escalation) {
      setEditedStatus(escalation.status);
      setEditedCategory(escalation.category);
      setAdminResponse(escalation.admin_response || "");
    }
  };

  // Initialize form when drawer opens
  if (open && escalation && editedStatus === null) {
    resetForm();
  }

  // Reset when drawer closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEditedStatus(null);
      setEditedCategory(null);
      setAdminResponse("");
    }
    onOpenChange(newOpen);
  };

  // Auto-save function for immediate updates
  const saveField = (updates: {
    status?: Escalation["status"];
    category?: Escalation["category"];
    admin_response?: string | null;
  }) => {
    if (!escalation) return;

    const newStatus = updates.status ?? editedStatus ?? escalation.status;
    const newCategory =
      updates.category ?? editedCategory ?? escalation.category;
    const newAdminResponse =
      updates.admin_response !== undefined
        ? updates.admin_response
        : adminResponse.trim() || null;

    startTransition(async () => {
      const result = await updateEscalation({
        id: escalation.id,
        status: newStatus,
        category: newCategory,
        admin_response: newAdminResponse,
      });

      if (result.success) {
        toast.success("Updated successfully");
        onUpdate({
          ...escalation,
          status: newStatus,
          category: newCategory,
          admin_response: newAdminResponse,
          resolved_at:
            newStatus === "resolved" ? new Date().toISOString() : null,
        });
      } else {
        toast.error(result.error || "Failed to update");
      }
    });
  };

  if (!escalation) return null;

  const currentCategory = editedCategory || escalation.category;
  const currentStatus = editedStatus || escalation.status;
  const category = categoryConfig[currentCategory];
  const status = statusConfig[currentStatus];

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="right">
      <DrawerContent className="h-full w-full min-w-[500px] sm:max-w-2xl fixed right-0 left-auto">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <span className="font-mono text-base">
                  #{escalation.id.substring(0, 8)}
                </span>
                <Badge variant="secondary" className={status.className}>
                  {status.label}
                </Badge>
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                {category.description}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Editable Status & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Status
              </Label>
              <Select
                value={currentStatus}
                onValueChange={(value: Escalation["status"]) => {
                  setEditedStatus(value);
                  saveField({ status: value });
                }}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      Pending
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      In Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="resolved">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Resolved
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Category
              </Label>
              <Select
                value={currentCategory}
                onValueChange={(value: Escalation["category"]) => {
                  setEditedCategory(value);
                  saveField({ category: value });
                }}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admission_dispute">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-purple-600" />
                      Admission Dispute
                    </div>
                  </SelectItem>
                  <SelectItem value="financial_hardship">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-amber-600" />
                      Financial Hardship
                    </div>
                  </SelectItem>
                  <SelectItem value="grievance">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Grievance
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* User Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              User Information
            </h3>
            <div className="grid gap-4">
              <DetailItem
                icon={Mail}
                label="Email"
                value={
                  <a
                    href={`mailto:${escalation.user_email}`}
                    className="text-primary hover:underline"
                  >
                    {escalation.user_email}
                  </a>
                }
              />
              <DetailItem
                icon={Phone}
                label="Phone"
                value={
                  escalation.user_phone ? (
                    <a
                      href={`tel:${escalation.user_phone}`}
                      className="text-primary hover:underline"
                    >
                      {escalation.user_phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )
                }
              />
            </div>
          </div>

          <Separator />

          {/* User Query */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              User Query
            </h3>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm whitespace-pre-wrap">{escalation.query}</p>
            </div>
          </div>

          {/* AI Comment */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Assessment
            </h3>
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                {escalation.ai_comment}
              </p>
            </div>
          </div>

          <Separator />

          {/* Admin Response - Editable */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Admin Response
            </Label>
            <Textarea
              placeholder="Enter your response to this escalation..."
              value={adminResponse}
              onChange={(e) => {
                setAdminResponse(e.target.value);
              }}
              onBlur={() => {
                // Save on blur if value changed from original
                if (
                  adminResponse.trim() !== (escalation.admin_response || "")
                ) {
                  saveField({ admin_response: adminResponse.trim() || null });
                }
              }}
              className="min-h-[120px] resize-none"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              This response will be visible in the ticket history.
            </p>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Timeline
            </h3>
            <div className="grid gap-4">
              <DetailItem
                icon={Clock}
                label="Created"
                value={formatDateTime(escalation.created_at)}
              />
              {escalation.resolved_at && (
                <DetailItem
                  icon={Calendar}
                  label="Resolved"
                  value={formatDateTime(escalation.resolved_at)}
                />
              )}
            </div>
          </div>

          {/* Ticket ID (Full) */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Full Ticket ID
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono block overflow-x-auto">
              {escalation.id}
            </code>
          </div>
        </div>

        <DrawerFooter className="border-t">
          {/* Contact Buttons */}
          {escalation.user_phone ? (
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(escalation.user_phone!);
                  toast.success("Phone number copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Number
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  // Remove any non-digit characters and ensure country code
                  const phone = escalation.user_phone!.replace(/\D/g, "");
                  // Add India country code if not present
                  const formattedPhone = phone.startsWith("91")
                    ? phone
                    : `91${phone}`;
                  window.open(`https://wa.me/${formattedPhone}`, "_blank");
                }}
              >
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Chat on WhatsApp
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No phone number available for this user
            </p>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function EscalationsTable({
  escalations,
  total,
  currentPage,
  pageSize,
}: EscalationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || ""
  );
  const [selectedEscalation, setSelectedEscalation] =
    useState<Escalation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  // Update URL with new params
  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`/dashboard/escalations?${params.toString()}`);
  };

  const handleSearch = () => {
    updateParams({ search: searchValue, page: "1" });
  };

  const handleStatusChange = (status: string) => {
    updateParams({ status, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    updateParams({ page: newPage.toString() });
  };

  const handleRowClick = (escalation: Escalation) => {
    setSelectedEscalation(escalation);
    setDrawerOpen(true);
  };

  const handleEscalationUpdate = (updated: Escalation) => {
    setSelectedEscalation(updated);
    // Refresh the page to get updated data
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} variant="secondary">
            Search
          </Button>
        </div>
        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Ticket</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {escalations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No escalations found.
                </TableCell>
              </TableRow>
            ) : (
              escalations.map((escalation) => {
                const category = categoryConfig[escalation.category];
                const status = statusConfig[escalation.status];
                const CategoryIcon = category.icon;

                return (
                  <TableRow
                    key={escalation.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(escalation)}
                  >
                    <TableCell className="font-mono text-sm">
                      #{escalation.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={category.className}>
                        <CategoryIcon className="h-3 w-3 mr-1" />
                        {category.shortLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate" title={escalation.query}>
                        {truncate(escalation.query, 50)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{escalation.user_email}</span>
                        {escalation.user_phone && (
                          <span className="text-xs text-muted-foreground">
                            {escalation.user_phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={status.className}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(escalation.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="w-8"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Escalation Detail Drawer */}
      <EscalationDrawer
        escalation={selectedEscalation}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={handleEscalationUpdate}
      />
    </div>
  );
}

// Loading skeleton
export function EscalationsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[180px]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Ticket</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead>Query</TableHead>
              <TableHead className="w-[200px]">User</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
