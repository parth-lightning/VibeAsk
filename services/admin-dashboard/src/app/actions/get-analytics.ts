"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface HourlyActivity {
  hour: string;
  messages: number;
  conversations: number;
}

export interface EscalationStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  by_category: {
    admission_dispute: number;
    financial_hardship: number;
    grievance: number;
  };
  avg_resolution_hours: number;
}

export interface KnowledgeGapStats {
  total: number;
  answered: number;
  pending: number;
  top_queries: Array<{ query: string; count: number }>;
}

export interface AnalyticsData {
  overview: {
    total_messages: number;
    total_conversations: number;
    total_users: number;
    user_messages: number;
    assistant_messages: number;
    voice_messages: number;
    text_messages: number;
  };
  hourly_activity: HourlyActivity[];
  escalations: EscalationStats;
  knowledge_gaps: KnowledgeGapStats;
  conversation_quality: {
    avg_messages_per_conversation: number;
    active_conversations: number;
    completed_conversations: number;
  };
  comparison: {
    messages_change: number;
    conversations_change: number;
    users_change: number;
  };
  error: string | null;
}

async function getCollegeId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profile not found");
  }

  return profile.college_id;
}

export async function getAnalytics(): Promise<AnalyticsData> {
  try {
    const collegeId = await getCollegeId();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Get messages from last 24 hours
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select(
        `
        id,
        role,
        is_voice,
        created_at,
        conversations!inner(college_id, id)
      `
      )
      .gte("created_at", twentyFourHoursAgo.toISOString());

    if (messagesError) throw messagesError;

    const collegeMessages = (messages || []).filter(
      (m: Record<string, unknown>) =>
        (m.conversations as { college_id: string })?.college_id === collegeId
    );

    // Get messages from previous 24 hours for comparison
    const { data: prevMessages } = await supabaseAdmin
      .from("messages")
      .select(
        `
        id,
        conversations!inner(college_id)
      `
      )
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .lt("created_at", twentyFourHoursAgo.toISOString());

    const collegePrevMessages = (prevMessages || []).filter(
      (m: Record<string, unknown>) =>
        (m.conversations as { college_id: string })?.college_id === collegeId
    );

    // Get conversations from last 24 hours
    const { data: conversations } = await supabaseAdmin
      .from("conversations")
      .select("id, created_at, updated_at, user_id")
      .eq("college_id", collegeId)
      .gte("created_at", twentyFourHoursAgo.toISOString());

    const { data: prevConversations } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("college_id", collegeId)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .lt("created_at", twentyFourHoursAgo.toISOString());

    // Get unique users from last 24 hours
    const uniqueUserIds = new Set(
      (conversations || []).map((c: { user_id: string }) => c.user_id)
    );

    const { data: prevUsers } = await supabaseAdmin
      .from("conversations")
      .select("user_id")
      .eq("college_id", collegeId)
      .gte("created_at", fortyEightHoursAgo.toISOString())
      .lt("created_at", twentyFourHoursAgo.toISOString());

    const prevUniqueUsers = new Set(
      (prevUsers || []).map((c: { user_id: string }) => c.user_id)
    );

    // Calculate overview stats
    const userMessages = collegeMessages.filter(
      (m: { role: string }) => m.role === "user"
    ).length;
    const assistantMessages = collegeMessages.filter(
      (m: { role: string }) => m.role === "assistant"
    ).length;
    const voiceMessages = collegeMessages.filter(
      (m: { is_voice: boolean }) => m.is_voice
    ).length;

    // Calculate hourly activity
    const hourlyMap = new Map<
      number,
      { messages: number; conversations: Set<string> }
    >();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, { messages: 0, conversations: new Set() });
    }

    collegeMessages.forEach((m) => {
      const msgData = m as unknown as {
        created_at: string;
        conversations: { id: string; college_id: string };
      };
      const hour = new Date(msgData.created_at).getHours();
      const stats = hourlyMap.get(hour)!;
      stats.messages++;
      stats.conversations.add(msgData.conversations.id);
    });

    const hourlyActivity: HourlyActivity[] = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, stats]) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        messages: stats.messages,
        conversations: stats.conversations.size,
      }));

    // Get escalations
    const { data: escalations } = await supabaseAdmin
      .from("human_escalations")
      .select("id, status, category, created_at, resolved_at")
      .eq("college_id", collegeId)
      .gte("created_at", twentyFourHoursAgo.toISOString());

    const escalationStats: EscalationStats = {
      total: escalations?.length || 0,
      pending:
        escalations?.filter((e: { status: string }) => e.status === "pending")
          .length || 0,
      in_progress:
        escalations?.filter(
          (e: { status: string }) => e.status === "in_progress"
        ).length || 0,
      resolved:
        escalations?.filter((e: { status: string }) => e.status === "resolved")
          .length || 0,
      by_category: {
        admission_dispute:
          escalations?.filter(
            (e: { category: string }) => e.category === "admission_dispute"
          ).length || 0,
        financial_hardship:
          escalations?.filter(
            (e: { category: string }) => e.category === "financial_hardship"
          ).length || 0,
        grievance:
          escalations?.filter(
            (e: { category: string }) => e.category === "grievance"
          ).length || 0,
      },
      avg_resolution_hours: 0,
    };

    // Calculate average resolution time
    const resolvedEscalations = escalations?.filter(
      (e: { status: string; resolved_at: string | null }) =>
        e.status === "resolved" && e.resolved_at
    );
    if (resolvedEscalations && resolvedEscalations.length > 0) {
      const totalHours = resolvedEscalations.reduce(
        (sum: number, e: { created_at: string; resolved_at: string }) => {
          const created = new Date(e.created_at).getTime();
          const resolved = new Date(e.resolved_at).getTime();
          return sum + (resolved - created) / (1000 * 60 * 60);
        },
        0
      );
      escalationStats.avg_resolution_hours =
        totalHours / resolvedEscalations.length;
    }

    // Get knowledge gaps
    const { data: knowledgeGaps } = await supabaseAdmin
      .from("knowledge_gaps")
      .select("id, query, answer, answered_at")
      .eq("college_id", collegeId)
      .gte("created_at", twentyFourHoursAgo.toISOString());

    const knowledgeGapStats: KnowledgeGapStats = {
      total: knowledgeGaps?.length || 0,
      answered:
        knowledgeGaps?.filter(
          (kg: { answer: string | null }) => kg.answer !== null
        ).length || 0,
      pending:
        knowledgeGaps?.filter(
          (kg: { answer: string | null }) => kg.answer === null
        ).length || 0,
      top_queries: [],
    };

    // Group similar queries (simplified - just show unique queries)
    const queryMap = new Map<string, number>();
    knowledgeGaps?.forEach((kg: { query: string }) => {
      const count = queryMap.get(kg.query) || 0;
      queryMap.set(kg.query, count + 1);
    });
    knowledgeGapStats.top_queries = Array.from(queryMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));

    // Calculate conversation quality
    const conversationMap = new Map<string, number>();
    collegeMessages.forEach((m) => {
      const msgData = m as unknown as {
        conversations: { id: string; college_id: string };
      };
      const count = conversationMap.get(msgData.conversations.id) || 0;
      conversationMap.set(msgData.conversations.id, count + 1);
    });

    const avgMessagesPerConv =
      conversationMap.size > 0
        ? Array.from(conversationMap.values()).reduce((a, b) => a + b, 0) /
          conversationMap.size
        : 0;

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const activeConversations =
      conversations?.filter(
        (c: { updated_at: string }) => new Date(c.updated_at) > oneHourAgo
      ).length || 0;

    // Calculate percentage changes
    const messagesChange =
      collegePrevMessages.length > 0
        ? ((collegeMessages.length - collegePrevMessages.length) /
            collegePrevMessages.length) *
          100
        : collegeMessages.length > 0
        ? 100
        : 0;

    const conversationsChange =
      (prevConversations?.length || 0) > 0
        ? (((conversations?.length || 0) - (prevConversations?.length || 0)) /
            (prevConversations?.length || 0)) *
          100
        : (conversations?.length || 0) > 0
        ? 100
        : 0;

    const usersChange =
      prevUniqueUsers.size > 0
        ? ((uniqueUserIds.size - prevUniqueUsers.size) / prevUniqueUsers.size) *
          100
        : uniqueUserIds.size > 0
        ? 100
        : 0;

    return {
      overview: {
        total_messages: collegeMessages.length,
        total_conversations: conversations?.length || 0,
        total_users: uniqueUserIds.size,
        user_messages: userMessages,
        assistant_messages: assistantMessages,
        voice_messages: voiceMessages,
        text_messages: collegeMessages.length - voiceMessages,
      },
      hourly_activity: hourlyActivity,
      escalations: escalationStats,
      knowledge_gaps: knowledgeGapStats,
      conversation_quality: {
        avg_messages_per_conversation: Math.round(avgMessagesPerConv * 10) / 10,
        active_conversations: activeConversations,
        completed_conversations:
          (conversations?.length || 0) - activeConversations,
      },
      comparison: {
        messages_change: Math.round(messagesChange * 10) / 10,
        conversations_change: Math.round(conversationsChange * 10) / 10,
        users_change: Math.round(usersChange * 10) / 10,
      },
      error: null,
    };
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    return {
      overview: {
        total_messages: 0,
        total_conversations: 0,
        total_users: 0,
        user_messages: 0,
        assistant_messages: 0,
        voice_messages: 0,
        text_messages: 0,
      },
      hourly_activity: [],
      escalations: {
        total: 0,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        by_category: {
          admission_dispute: 0,
          financial_hardship: 0,
          grievance: 0,
        },
        avg_resolution_hours: 0,
      },
      knowledge_gaps: {
        total: 0,
        answered: 0,
        pending: 0,
        top_queries: [],
      },
      conversation_quality: {
        avg_messages_per_conversation: 0,
        active_conversations: 0,
        completed_conversations: 0,
      },
      comparison: {
        messages_change: 0,
        conversations_change: 0,
        users_change: 0,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
