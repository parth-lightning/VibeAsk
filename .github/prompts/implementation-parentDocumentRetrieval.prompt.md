# Implementation Plan: Parent Document Retrieval RAG

## Current State Analysis

### Existing Tables

| Table       | Rows | Purpose                                                                  |
| ----------- | ---- | ------------------------------------------------------------------------ |
| `files`     | 2    | Parent files with metadata (name, college_id, document_type, source_url) |
| `documents` | 13   | Chunks with embeddings, linked to files via `file_id`                    |

### Current Data Flow

```
Upload → Parse → Chunk (fixed 1000 chars) → Embed Each Chunk → Store in `documents`
```

### Problems with Current Approach

1. **Fixed-size chunking** (`chunkText` in `lib/utils.ts`) breaks sentences mid-way
2. **No parent retrieval** - AI only sees the matched chunk, not surrounding context
3. **Summary embedding for forms** - Low similarity scores (37%) because summaries are too abstract
4. **Text content has `source_url: null`** - Which is correct and should be preserved

---

## Migration Strategy: **NON-BREAKING**

We will **NOT drop tables**. Instead, we will:

1. **Rename** `documents` → `document_chunks` (conceptually - via new column)
2. **Add a new `parent_documents` table** for storing full content
3. **Add `parent_document_id` column** to existing `documents` table
4. **Update `match_documents` function** to return parent info

### Why Non-Breaking?

- Existing data continues to work
- Old chunks without parents still return their own content
- Gradual migration: new uploads use new system, old data still works

---

## Phase 1: Database Migration

### Migration SQL

```sql
-- 1. Create parent_documents table
-- This stores the FULL markdown content for retrieval
CREATE TABLE IF NOT EXISTS parent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES files(id) ON DELETE CASCADE,
  content text NOT NULL, -- Full markdown content
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Index for faster file lookups
CREATE INDEX IF NOT EXISTS parent_documents_file_id_idx ON parent_documents(file_id);

-- 2. Add parent reference to existing documents table
-- This links chunks to their parent document
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES parent_documents(id) ON DELETE CASCADE;

-- Index for faster parent lookups
CREATE INDEX IF NOT EXISTS documents_parent_document_id_idx ON documents(parent_document_id);

-- 3. Update match_documents function to return parent info
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding_text text,
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  parent_content text,  -- NEW: Full parent document
  file_id uuid          -- NEW: For source_url lookup
)
LANGUAGE sql
AS $$
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding_text::vector(1536)) AS similarity,
    COALESCE(pd.content, d.content) AS parent_content, -- Fallback to chunk if no parent
    d.file_id
  FROM documents d
  LEFT JOIN parent_documents pd ON d.parent_document_id = pd.id
  WHERE 1 - (d.embedding <=> query_embedding_text::vector(1536)) >= match_threshold
  AND d.metadata @> filter
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

### Rollback SQL (if needed)

```sql
-- Revert function
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding_text text,
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding_text::vector(1536)) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding_text::vector(1536)) >= match_threshold
  AND documents.metadata @> filter
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Drop new columns/tables
ALTER TABLE documents DROP COLUMN IF EXISTS parent_document_id;
DROP TABLE IF EXISTS parent_documents;
```

---

## Phase 2: Install Dependencies

In `services/ai-service`:

```bash
npm install @chonkiejs/core
```

---

## Phase 3: Code Changes

### 3.1 New File: `services/ai-service/src/lib/rag/chunker.ts`

```typescript
import { RecursiveChunker } from "@chonkiejs/core";

let chunkerInstance: RecursiveChunker | null = null;

/**
 * Get or create RecursiveChunker instance (singleton)
 * RecursiveChunker splits at natural boundaries: paragraphs > lines > sentences > words
 */
export async function getChunker(): Promise<RecursiveChunker> {
  if (!chunkerInstance) {
    chunkerInstance = await RecursiveChunker.create({
      chunkSize: 256, // ~256 tokens per chunk
      chunkOverlap: 50, // Overlap for context continuity
      minCharactersPerChunk: 24, // Minimum chunk size
    });
  }
  return chunkerInstance;
}
```

### 3.2 New File: `services/ai-service/src/lib/rag/ingest.ts`

```typescript
import { getSupabase } from "./supabase.js";
import { getChunker } from "./chunker.js";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

interface IngestParams {
  markdown: string;
  fileId: string;
  metadata: {
    title: string;
    college_id: string;
    source_url: string | null;
    document_type: "info" | "form" | "text";
  };
}

export async function ingestDocument({
  markdown,
  fileId,
  metadata,
}: IngestParams) {
  const supabase = getSupabase();

  // 1. Store Parent Document (Full Content)
  const { data: parentDoc, error: parentError } = await supabase
    .from("parent_documents")
    .insert({
      file_id: fileId,
      content: markdown,
    })
    .select()
    .single();

  if (parentError) throw parentError;

  // 2. Chunk the markdown
  const chunker = await getChunker();
  const chunks = await chunker.chunk(markdown);

  // 3. Generate embeddings with enrichment
  const chunksWithEmbeddings = await Promise.all(
    chunks.map(async (chunk, index) => {
      // Enrichment: Prepend context to improve retrieval
      const enrichedText = `Document: ${metadata.title}\nType: ${metadata.document_type}\n\n${chunk.text}`;

      const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-small"),
        value: enrichedText,
      });

      return {
        content: chunk.text,
        embedding,
        parent_document_id: parentDoc.id,
        file_id: fileId,
        metadata: {
          ...metadata,
          chunk_index: index,
        },
      };
    })
  );

  // 4. Batch insert chunks
  const { error: chunkError } = await supabase
    .from("documents")
    .insert(chunksWithEmbeddings);

  if (chunkError) throw chunkError;

  return {
    success: true,
    parentId: parentDoc.id,
    chunkCount: chunks.length,
  };
}
```

### 3.3 Update: `services/ai-service/src/lib/rag/search.ts`

**Add parent content to return type:**

```typescript
export interface SearchResult {
  id: string;
  content: string; // Matched chunk
  metadata: Record<string, unknown>;
  similarity: number;
  parent_content: string; // NEW: Full document
  source_url: string | null; // NEW: Citation link
}
```

**Update search function to handle new return values:**

```typescript
// After RPC call, fetch source_url from files table
const results = await supabase.rpc('match_documents', { ... });

// Enrich with source_url
const enrichedResults = await Promise.all(
  results.data.map(async (result) => {
    let source_url = null;
    if (result.file_id) {
      const { data: file } = await supabase
        .from('files')
        .select('source_url')
        .eq('id', result.file_id)
        .single();
      source_url = file?.source_url || null;
    }
    return {
      ...result,
      source_url,
      // Use parent_content for AI context, chunk content for debugging
    };
  })
);
```

### 3.4 Update: Admin Dashboard Upload Actions

**`upload-document.ts` (Informational Docs):**
Replace `chunkText()` with call to `ingestDocument()` via API or direct import.

**`upload-form.ts` (Forms/Notices):**

- Remove summary generation
- Call `ingestDocument()` with Mistral OCR output

**`text-content.ts` (Raw Text):**

- Call `ingestDocument()` with `source_url: null`

---

## Phase 4: Update AI Prompts

When feeding context to the AI, use `parent_content` instead of `content`:

```typescript
const context = results
  .map((r) => {
    const citation = r.source_url ? `\n📎 Source: ${r.source_url}` : "";
    return `---\n${r.parent_content}${citation}\n---`;
  })
  .join("\n\n");
```

---

## Files to Modify

| File                                                          | Change Type                     |
| ------------------------------------------------------------- | ------------------------------- |
| `services/ai-service/package.json`                            | Add `@chonkiejs/core`           |
| `services/ai-service/src/lib/rag/chunker.ts`                  | **NEW**                         |
| `services/ai-service/src/lib/rag/ingest.ts`                   | **NEW**                         |
| `services/ai-service/src/lib/rag/search.ts`                   | Update return type              |
| `services/admin-dashboard/src/app/actions/upload-document.ts` | Use new ingestion               |
| `services/admin-dashboard/src/app/actions/upload-form.ts`     | Remove summary, use ingestion   |
| `services/admin-dashboard/src/app/actions/text-content.ts`    | Use ingestion with null source  |
| `services/admin-dashboard/src/lib/utils.ts`                   | Remove `chunkText()` (optional) |

---

## Testing Checklist

- [ ] Old documents still return results (backward compatible)
- [ ] New uploads create parent + chunks
- [ ] `match_documents` returns `parent_content`
- [ ] Forms/Notices have `source_url` (Supabase public link)
- [ ] Text content has `source_url: null`
- [ ] Scraped websites have `source_url` (original URL)
- [ ] AI receives full context, not just chunk

---

## Approval Required Before Proceeding

**Please confirm:**

1. ✅ Database migration SQL looks correct
2. ✅ Code file structure is acceptable
3. ✅ Non-breaking migration approach is preferred
4. ✅ Ready to execute Phase 1 (Database Migration)

**Reply with:** "Approved, proceed with Phase 1" to start implementation.
