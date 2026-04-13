# Knowledge Gap Logging Tool - Implementation Plan

## Overview

Implement an AI tool that detects unanswered user queries and logs them to Supabase for admin review. When admin provides an answer, automatically cascade the Q&A into RAG for future retrieval.

## Flow

1. **AI logs gap** → `knowledge_gaps` table (answer = null)
2. **Admin answers** → manually in Supabase dashboard
3. **On answer completion** → Database Webhook triggers Edge Function → cascades Q&A into RAG (`documents` table), sets `cascaded_at`

---

## Implementation Steps

### Step 1: Create `knowledge_gaps` Table (Migration)

**Tool:** `mcp_supabase_apply_migration`

```sql
-- Enable pg_net extension for async HTTP (required for webhooks)
create extension if not exists pg_net with schema extensions;

-- Knowledge gaps table
create table if not exists public.knowledge_gaps (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  ai_comment text not null,
  college_id text not null,
  answer text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  answered_at timestamp with time zone,
  cascaded_at timestamp with time zone
);

-- Indexes
create index if not exists knowledge_gaps_college_id_idx on public.knowledge_gaps(college_id);
create index if not exists knowledge_gaps_pending_idx on public.knowledge_gaps(id) where answer is null;

-- Comments
comment on table public.knowledge_gaps is 'Stores user queries that AI could not answer from the knowledge base';
comment on column public.knowledge_gaps.query is 'Original user question';
comment on column public.knowledge_gaps.ai_comment is 'AI explanation of what info is missing';
comment on column public.knowledge_gaps.answer is 'Admin-provided answer (null until answered)';
comment on column public.knowledge_gaps.cascaded_at is 'Timestamp when Q&A was added to RAG';
```

---

### Step 2: Add `logKnowledgeGap` Tool

**Location:** `services/ai-service/src/lib/ai/rag-tools.ts`

```typescript
logKnowledgeGap: tool({
  description: `Log a knowledge gap when you cannot find information in the knowledge base.

Use this tool when:
- searchDocuments returns no relevant results for a legitimate college-related question
- The question is something students/visitors would reasonably ask
- The information SHOULD exist in the knowledge base but doesn't

DO NOT use for:
- Off-topic questions (weather, general trivia, etc.)
- Questions you successfully answered
- Vague or unclear questions`,

  inputSchema: z.object({
    originalQuery: z.string().describe("The user's original question exactly as asked"),
    aiComment: z.string().describe("Brief explanation of what information is missing and why it would be helpful"),
  }),

  execute: async ({ originalQuery, aiComment }: { originalQuery: string; aiComment: string }) => {
    try {
      if (!collegeId) {
        return {
          success: false,
          message: "Cannot log knowledge gap without college context",
        };
      }

      const supabase = getSupabase();

      const { error } = await supabase.from("knowledge_gaps").insert({
        query: originalQuery,
        ai_comment: aiComment,
        college_id: collegeId,
      });

      if (error) {
        logger.error("Failed to log knowledge gap:", error);
        return { success: false, message: "Failed to log knowledge gap" };
      }

      logger.info("Knowledge gap logged", { query: originalQuery, collegeId });
      return {
        success: true,
        message: "Knowledge gap has been logged for the admin to review"
      };
    } catch (error) {
      logger.error("Knowledge gap tool error:", error);
      return { success: false, message: "Error logging knowledge gap" };
    }
  },
}),
```

---

### Step 3: Update System Prompt

**Location:** `services/ai-service/src/lib/ai/prompts.ts`

Add to existing prompt:

```
KNOWLEDGE GAP LOGGING:
- If searchDocuments returns empty for a valid college-related question, use logKnowledgeGap tool
- Provide a helpful AI comment explaining what information would answer the user's question
- After logging, politely inform user their question has been noted for the admin team to review
- Valid gap examples: fees, faculty info, facilities, schedules, admission policies, hostel details
- Do NOT log: off-topic questions, successfully answered queries, vague/unclear questions
```

---

### Step 4: Add TypeScript Types

**Location:** `services/ai-service/src/types/index.ts`

```typescript
export interface KnowledgeGap {
  id: string;
  query: string;
  ai_comment: string;
  college_id: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  cascaded_at: string | null;
}
```

---

### Step 5: Create Edge Function for RAG Cascade

**Tool:** `mcp_supabase_deploy_edge_function`
**Name:** `cascade-knowledge-gap`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

interface WebhookPayload {
  type: "UPDATE";
  table: string;
  schema: string;
  record: {
    id: string;
    query: string;
    ai_comment: string;
    college_id: string;
    answer: string;
    created_at: string;
    answered_at: string | null;
    cascaded_at: string | null;
  };
  old_record: {
    id: string;
    query: string;
    ai_comment: string;
    college_id: string;
    answer: string | null;
    created_at: string;
    answered_at: string | null;
    cascaded_at: string | null;
  };
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    // Only process if answer changed from null to a value
    if (payload.old_record.answer !== null || payload.record.answer === null) {
      return new Response(JSON.stringify({ message: "No action needed" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Already cascaded
    if (payload.record.cascaded_at !== null) {
      return new Response(JSON.stringify({ message: "Already cascaded" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id, query, answer, college_id } = payload.record;

    // Format Q&A for embedding
    const content = `Question: ${query}\n\nAnswer: ${answer}`;
    const enrichedContent = `College FAQ - Knowledge Gap Resolution\n\n${content}`;

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: enrichedContent,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Insert into documents table
    const { error: insertError } = await supabase.from("documents").insert({
      content: content,
      embedding: embedding,
      metadata: {
        college_id: college_id,
        source: "knowledge_gap",
        knowledge_gap_id: id,
        is_faq: true,
      },
    });

    if (insertError) {
      console.error("Failed to insert document:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update knowledge_gaps with cascaded_at and answered_at
    const { error: updateError } = await supabase
      .from("knowledge_gaps")
      .update({
        cascaded_at: new Date().toISOString(),
        answered_at: payload.record.answered_at || new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update knowledge gap:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Knowledge gap cascaded to RAG",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

### Step 6: Create Database Webhook Trigger

**Tool:** `mcp_supabase_apply_migration`

After deploying the edge function, create a webhook trigger:

```sql
-- Create webhook trigger for knowledge_gaps updates
-- This calls the edge function when answer is updated
create trigger knowledge_gap_cascade_webhook
  after update on public.knowledge_gaps
  for each row
  when (old.answer is null and new.answer is not null)
  execute function supabase_functions.http_request(
    'https://trkrrxdlipgcydxroqve.supabase.co/functions/v1/cascade-knowledge-gap',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
```

**Note:** The webhook URL will need the project URL. You may also set this up via the Supabase Dashboard under Database > Webhooks for easier configuration.

---

## AI Comment Examples

| User Query                            | AI Comment                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| "What is the hostel fee for boys?"    | "Hostel fee information not found. This is essential admission-related data students need." |
| "Who is the HOD of Computer Science?" | "Department head/faculty contact info missing. Important for academic queries."             |
| "What are the bus routes to campus?"  | "Transportation info unavailable. Helpful for commuting students."                          |
| "Is there a placement cell?"          | "Placement/career services info not documented. Critical for prospective students."         |
| "What scholarships are available?"    | "Scholarship and financial aid details missing. Important for students seeking funding."    |

---

## Files to Modify/Create

| File               | Action                                               |
| ------------------ | ---------------------------------------------------- |
| Supabase Migration | Create `knowledge_gaps` table                        |
| `rag-tools.ts`     | Add `logKnowledgeGap` tool                           |
| `prompts.ts`       | Update system prompt with knowledge gap instructions |
| `types/index.ts`   | Add `KnowledgeGap` interface                         |
| Edge Function      | Deploy `cascade-knowledge-gap`                       |
| Database Webhook   | Create trigger on `knowledge_gaps` UPDATE            |

---

## Testing Checklist

- [ ] Migration applied successfully
- [ ] `knowledge_gaps` table created with correct schema
- [ ] `logKnowledgeGap` tool added to `rag-tools.ts`
- [ ] System prompt updated in `prompts.ts`
- [ ] Edge function deployed
- [ ] Webhook trigger created
- [ ] Test: Send query with no RAG results → AI calls `logKnowledgeGap`
- [ ] Test: Check `knowledge_gaps` table for new row
- [ ] Test: Manually add answer in Supabase dashboard
- [ ] Test: Verify webhook fires and cascades to `documents`
- [ ] Test: Verify `cascaded_at` timestamp is set
- [ ] Test: Send same query again → should now return from RAG

---

## Environment Variables Required

Edge function needs these secrets:

- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
- `OPENAI_API_KEY` (must be set via `supabase secrets set`)
