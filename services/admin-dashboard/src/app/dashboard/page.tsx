import { Suspense } from "react";
import { getAnalytics } from "@/app/actions/get-analytics";
import { getRecentChats } from "@/app/actions/get-recent-chats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Phone,
  User,
  Bot,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  MessageCircle,
} from "lucide-react";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return date.toLocaleDateString();
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

async function AnalyticsContent() {
  const [analytics, recentChats] = await Promise.all([
    getAnalytics(),
    getRecentChats(),
  ]);

  if (analytics.error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-600">
            Error loading analytics: {analytics.error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    overview,
    hourly_activity,
    escalations,
    knowledge_gaps,
    conversation_quality,
    comparison,
  } = analytics;

  return (
    <div className="space-y-6">
      {/* Overview Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium">
              Total Messages
            </CardTitle>
            <MessageSquare className="h-8 w-8" style={{ color: "#004aad" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.total_messages}</div>
            <div className="flex items-center text-sm text-muted-foreground">
              {comparison.messages_change >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
              )}
              <span
                className={
                  comparison.messages_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }
              >
                {Math.abs(comparison.messages_change).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous 24h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium">
              Conversations
            </CardTitle>
            <Users className="h-8 w-8" style={{ color: "#004aad" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overview.total_conversations}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              {comparison.conversations_change >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
              )}
              <span
                className={
                  comparison.conversations_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }
              >
                {Math.abs(comparison.conversations_change).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous 24h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium">
              Unique Users
            </CardTitle>
            <User className="h-8 w-8" style={{ color: "#004aad" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.total_users}</div>
            <div className="flex items-center text-sm text-muted-foreground">
              {comparison.users_change >= 0 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
              )}
              <span
                className={
                  comparison.users_change >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }
              >
                {Math.abs(comparison.users_change).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous 24h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium">
              Avg Conv Length
            </CardTitle>
            <MessageCircle className="h-8 w-8" style={{ color: "#004aad" }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {conversation_quality.avg_messages_per_conversation}
            </div>
            <p className="text-sm text-muted-foreground">
              messages per conversation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Activity Chart */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-xl">Hourly Activity</CardTitle>
          <CardDescription className="text-base">
            Messages per hour in last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] overflow-y-auto">
            {hourly_activity.length > 0 ? (
              <div className="space-y-3 pr-2">
                {hourly_activity
                  .filter((h) => h.messages > 0)
                  .slice(0, 10)
                  .map((item) => (
                    <div key={item.hour} className="flex items-center gap-2">
                      <div className="text-sm font-mono w-16 shrink-0 text-muted-foreground">
                        {item.hour}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="h-10 rounded bg-primary/20 flex items-center px-2"
                          style={{
                            width: `${
                              (item.messages /
                                Math.max(
                                  ...hourly_activity.map((h) => h.messages)
                                )) *
                              100
                            }%`,
                            minWidth: "40px",
                          }}
                        >
                          <span className="text-sm font-medium">
                            {item.messages}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No activity data
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escalations and Knowledge Gaps */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Escalations */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-6 w-6" />
              Escalations
            </CardTitle>
            <CardDescription className="text-base">
              {escalations.total} total escalations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {escalations.pending}
                </div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {escalations.in_progress}
                </div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {escalations.resolved}
                </div>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>

            {escalations.avg_resolution_hours > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Avg resolution time:{" "}
                  <strong>
                    {escalations.avg_resolution_hours.toFixed(1)}h
                  </strong>
                </span>
              </div>
            )}

            <div className="pt-2">
              <p className="text-base font-medium mb-2">By Category:</p>
              <div className="space-y-1">
                <div className="flex justify-between text-base">
                  <span>Admission Disputes</span>
                  <span className="font-medium">
                    {escalations.by_category.admission_dispute}
                  </span>
                </div>
                <div className="flex justify-between text-base">
                  <span>Financial Hardship</span>
                  <span className="font-medium">
                    {escalations.by_category.financial_hardship}
                  </span>
                </div>
                <div className="flex justify-between text-base">
                  <span>Grievances</span>
                  <span className="font-medium">
                    {escalations.by_category.grievance}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Gaps */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle className="h-6 w-6" />
              Knowledge Gaps
            </CardTitle>
            <CardDescription className="text-base">
              {knowledge_gaps.total === 0
                ? "No unanswered queries in last 24h"
                : `${knowledge_gaps.total} queries AI couldn't answer (from database)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledge_gaps.total === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>All queries were answered successfully!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {knowledge_gaps.pending}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {knowledge_gaps.answered}
                    </div>
                    <p className="text-sm text-muted-foreground">Answered</p>
                  </div>
                </div>

                {knowledge_gaps.top_queries.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-base font-medium mb-2">
                      Top Unanswered Queries:
                    </p>
                    <div className="space-y-2">
                      {knowledge_gaps.top_queries
                        .slice(0, 3)
                        .map((item, idx) => (
                          <div key={idx} className="text-base">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="mt-0.5">
                                {item.count}x
                              </Badge>
                              <span className="text-muted-foreground">
                                {truncateText(item.query, 60)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversation Quality */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-xl">
            Conversation Quality Metrics
          </CardTitle>
          <CardDescription className="text-base">
            Engagement and conversation insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold">
                {conversation_quality.avg_messages_per_conversation}
              </div>
              <p className="text-base text-muted-foreground mt-1">
                Avg Messages/Conv
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold text-green-600">
                {conversation_quality.active_conversations}
              </div>
              <p className="text-base text-muted-foreground mt-1">
                Active Conversations
              </p>
              <p className="text-xs text-muted-foreground">
                (messages in last hour)
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-4xl font-bold text-gray-600">
                {conversation_quality.completed_conversations}
              </div>
              <p className="text-base text-muted-foreground mt-1">Completed</p>
              <p className="text-xs text-muted-foreground">
                (no activity in 1h+)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Chats Table */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-xl">Recent Chat Logs</CardTitle>
          <CardDescription className="text-base">
            Latest messages from the last 24 hours (showing{" "}
            {recentChats.messages.length} messages)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>
              Chat logs are encrypted and securely stored
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Time</TableHead>
                <TableHead className="w-20">Role</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-48">User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentChats.messages.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No messages in the last 24 hours
                  </TableCell>
                </TableRow>
              ) : (
                recentChats.messages.slice(0, 20).map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-mono text-xs">
                      {formatTimeAgo(message.created_at)}
                    </TableCell>
                    <TableCell>
                      {message.role === "user" ? (
                        <Badge variant="secondary" className="gap-1">
                          <User className="h-3 w-3" />
                          User
                        </Badge>
                      ) : message.role === "assistant" ? (
                        <Badge variant="default" className="gap-1">
                          <Bot className="h-3 w-3" />
                          AI
                        </Badge>
                      ) : (
                        <Badge variant="outline">System</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-base wrap-break-word whitespace-normal">
                        {truncateText(message.content, 100)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {message.is_voice ? (
                        <Badge variant="secondary" className="gap-1">
                          <Phone className="h-3 w-3" />
                          Voice
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Text
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {message.user_email || "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Analytics Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive insights from the last 24 hours
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </div>
  );
}
