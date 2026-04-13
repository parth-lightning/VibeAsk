---
agent: agent
---
Define the task to achieve, including specific requirements, constraints, and success criteria.


# RAG Enhancement Plan - Admin Upload Split

## Overview
Enhance the RAG system by splitting admin uploads into two categories:
1. **Information Documents** - Chunked & embedded (existing flow)
2. **Forms/Notices** - Summary-based, full document retrieval

This allows forms/notices to be given in full context to the AI while still being semantically searchable.

---

## Phase 1: Database Schema Changes

### Goal
Add `document_type` field to differentiate between info docs and forms/notices.

### Changes Required

#### 1.1 Update `files` table
```sql
-- Add document_type column to files table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'info' 
CHECK (document_type IN ('info', 'form'));

-- Add source_url for clickable citations
ALTER TABLE files
ADD COLUMN IF NOT EXISTS source_url text;
```

#### 1.2 Update `documents` table metadata
No schema change needed - the existing `metadata` JSONB column can store additional fields:
- `is_summary: boolean` - True for summary embeddings
- `document_type: 'info' | 'form'` - Document category

### Testing Checklist
- [ ] Run migration on Supabase
- [ ] Verify existing data still works
- [ ] Test `match_documents` still returns results correctly

---

## Phase 2: Admin Dashboard UI Split

### Goal
Split the upload page into two sections: "Information Documents" and "Forms/Notices"

### Changes Required

#### 2.1 Update Upload Page UI
**File:** `services/admin-dashboard/src/app/dashboard/uploads/page.tsx`

Create tabbed interface:
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function UploadsPage() {
  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList>
        <TabsTrigger value="info">Information Documents</TabsTrigger>
        <TabsTrigger value="forms">Forms & Notices</TabsTrigger>
      </TabsList>
      
      <TabsContent value="info">
        {/* Existing upload component for chunked RAG */}
        <InfoDocumentUpload />
      </TabsContent>
      
      <TabsContent value="forms">
        {/* New upload component for summary-based */}
        <FormNoticeUpload />
      </TabsContent>
    </Tabs>
  )
}
```

#### 2.2 Create FormNoticeUpload Component
**File:** `services/admin-dashboard/src/components/form-notice-upload.tsx`

- File picker (PDF, DOC, images)
- Optional title override
- Optional description/keywords
- College selector
- Upload button

### Testing Checklist
- [ ] Both tabs render correctly
- [ ] File upload works in both tabs
- [ ] College selection works
- [ ] UI is responsive

---

## Phase 3: Summary-Based Upload Flow for Forms

### Goal
Create a new server action that:
1. Uploads file to storage
2. Extracts text (using existing parser or Mistral OCR for Hindi)
3. Generates AI summary
4. Embeds only the summary
5. Stores with `is_summary: true` and full file path

### Changes Required

#### 3.1 Create Summary Upload Action
**File:** `services/admin-dashboard/src/app/actions/upload-form.ts`

```typescript
'use server'

import { createClient } from '@/lib/supabase'
import { parseFile } from '@/lib/parser'
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function uploadForm(formData: FormData) {
  const file = formData.get('file') as File
  const collegeId = formData.get('collegeId') as string
  const title = formData.get('title') as string | null
  
  const supabase = await createClient()
  
  // 1. Upload to storage
  const fileName = `${collegeId}/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, file)
  
  if (uploadError) throw uploadError
  
  // 2. Get public URL for citation links
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName)
  
  // 3. Extract text (for generating summary)
  const text = await parseFile(file)
  
  // 4. Generate AI summary
  const summary = await generateSummary(text, file.name)
  
  // 5. Embed only the summary
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: summary,
  })
  
  // 6. Store in database
  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .insert({
      name: title || file.name,
      url: uploadData.path,
      source_url: urlData.publicUrl, // For clickable citations
      college_id: collegeId,
      size: file.size,
      type: file.type,
      document_type: 'form', // Mark as form/notice
    })
    .select()
    .single()
  
  if (fileError) throw fileError
  
  // 7. Store summary embedding (not chunks)
  const { error: docError } = await supabase
    .from('documents')
    .insert({
      content: summary, // Store summary as content
      metadata: {
        filename: file.name,
        college_id: collegeId,
        is_summary: true, // Flag for full doc retrieval
        document_type: 'form',
        storage_path: uploadData.path,
        public_url: urlData.publicUrl,
        original_length: text.length,
      },
      embedding: JSON.stringify(embedding),
      file_id: fileRecord.id,
    })
  
  if (docError) throw docError
  
  return { success: true, fileId: fileRecord.id }
}

async function generateSummary(text: string, filename: string): Promise<string> {
  // Use AI to generate searchable summary
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a comprehensive summary of this document that captures:
1. Document type (form, notice, circular, application, etc.)
2. Purpose and what it's for
3. Key topics, keywords in both Hindi and English
4. Who should use this document
5. Any important dates or deadlines mentioned

Keep the summary under 500 words but include all searchable terms.`
        },
        {
          role: 'user',
          content: `Document: ${filename}\n\nContent:\n${text.slice(0, 10000)}`
        }
      ],
      max_tokens: 600,
    }),
  })
  
  const data = await response.json()
  return data.choices[0].message.content
}
```

### Testing Checklist
- [ ] Upload form/notice successfully
- [ ] Summary is generated correctly
- [ ] Summary is embedded and stored
- [ ] `is_summary: true` flag is set in metadata
- [ ] Public URL is stored for citations

---

## Phase 4: Clickable Citations in AI Responses

### Goal
When AI cites a document, provide a clickable link to the full document.

### Changes Required

#### 4.1 Update Search Results Formatting
**File:** `services/ai-service/src/lib/rag/search.ts`

```typescript
export function formatContext(results: SearchResult[]): string {
  return results.map((result, index) => {
    const filename = result.metadata?.filename || 'Unknown'
    const publicUrl = result.metadata?.public_url
    const isSummary = result.metadata?.is_summary
    
    // Create citation with link if available
    let source = filename
    if (publicUrl) {
      source = `[${filename}](${publicUrl})`
    }
    
    // Mark if this is a summary (AI should fetch full doc if needed)
    const summaryNote = isSummary 
      ? ' [Full document available - click link to view]' 
      : ''
    
    return `Document ${index + 1} (Source: ${source}${summaryNote}):
${result.content}
(Relevance: ${(result.similarity * 100).toFixed(1)}%)`
  }).join('\n\n---\n\n')
}
```

#### 4.2 Update System Prompt
**File:** `services/ai-service/src/lib/ai/chat.ts` (or wherever system prompt is)

Add to system prompt:
```
When citing documents, always include the source link in markdown format.
For forms and notices, encourage users to click the link to view/download the full document.
Example: "You can download the Vidya Sambal Yojana application form here: [Application Form](https://...)"
```

### Testing Checklist
- [ ] Search results include public URLs
- [ ] AI responses contain clickable markdown links
- [ ] Links open correct documents

---

## Phase 5: Mistral OCR for Hindi PDFs

### Goal
Use Mistral OCR (`mistral-ocr-latest`) for extracting text from Hindi PDFs and scanned documents.

### Changes Required

#### 5.1 Install Mistral Client
```bash
cd services/admin-dashboard
npm install @mistralai/mistralai
```

#### 5.2 Create OCR Utility
**File:** `services/admin-dashboard/src/lib/ocr.ts`

```typescript
import { Mistral } from "@mistralai/mistralai"

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
})

export async function extractTextWithOCR(fileUrl: string): Promise<string> {
  const result = await mistral.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: fileUrl,
      type: "document_url",
    },
  })
  
  // OCR returns pages with markdown content
  const pages = result.pages || []
  const text = pages.map(page => page.markdown).join('\n\n---\n\n')
  
  return text
}

// For local files, upload to temp storage first
export async function extractTextFromBuffer(
  buffer: Buffer, 
  filename: string,
  supabase: any
): Promise<string> {
  // Upload to temp location
  const tempPath = `temp/${Date.now()}-${filename}`
  await supabase.storage.from('documents').upload(tempPath, buffer)
  
  // Get public URL
  const { data } = supabase.storage.from('documents').getPublicUrl(tempPath)
  
  // Process with OCR
  const text = await extractTextWithOCR(data.publicUrl)
  
  // Clean up temp file
  await supabase.storage.from('documents').remove([tempPath])
  
  return text
}
```

#### 5.3 Update Parser to Use OCR for Hindi/Scanned Docs
**File:** `services/admin-dashboard/src/lib/parser.ts`

```typescript
import { extractTextFromBuffer } from './ocr'

export async function parseFile(
  file: File, 
  useOCR: boolean = false,
  supabase?: any
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  
  // Use Mistral OCR for Hindi or scanned documents
  if (useOCR && supabase) {
    return await extractTextFromBuffer(buffer, file.name, supabase)
  }
  
  // Existing parsing logic for standard docs
  // ... existing code ...
}
```

#### 5.4 Add OCR Toggle in Form Upload UI
Add a checkbox in the FormNoticeUpload component:
```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="useOcr" checked={useOcr} onCheckedChange={setUseOcr} />
  <Label htmlFor="useOcr">
    Use OCR for Hindi/scanned documents
  </Label>
</div>
```

### Testing Checklist
- [ ] Mistral API key is configured
- [ ] OCR extracts text from Hindi PDFs correctly
- [ ] OCR extracts text from scanned images
- [ ] Toggle works in upload UI
- [ ] Extracted Hindi text can be summarized

---

## Phase 6: Enhanced RAG Search for Full Document Retrieval

### Goal
When a form/notice is matched, fetch the full document text for AI context (not just the summary).

### Changes Required

#### 6.1 Update Search Function
**File:** `services/ai-service/src/lib/rag/search.ts`

```typescript
export async function searchDocuments(query: string, collegeId?: string) {
  // ... existing embedding and search code ...
  
  const results = await supabase.rpc('match_documents', {
    query_embedding_text: JSON.stringify(embedding),
    match_threshold: 0.3,
    match_count: 5,
    filter: collegeId ? { college_id: collegeId } : {},
  })
  
  // For summary documents, fetch full content
  const enrichedResults = await Promise.all(
    results.data.map(async (result) => {
      if (result.metadata?.is_summary && result.metadata?.storage_path) {
        // Fetch full document from storage
        const { data } = await supabase.storage
          .from('documents')
          .download(result.metadata.storage_path)
        
        if (data) {
          const fullText = await data.text()
          return {
            ...result,
            full_content: fullText, // Add full content
          }
        }
      }
      return result
    })
  )
  
  return enrichedResults
}
```

#### 6.2 Update Context Formatting
Include full content for forms when available:
```typescript
export function formatContext(results: SearchResult[]): string {
  return results.map((result, index) => {
    const content = result.full_content || result.content
    const isFull = !!result.full_content
    
    return `Document ${index + 1} (Source: ${source})${isFull ? ' [Full Document]' : ''}:
${content}
(Relevance: ${(result.similarity * 100).toFixed(1)}%)`
  }).join('\n\n---\n\n')
}
```

### Testing Checklist
- [ ] Summary documents trigger full content fetch
- [ ] Full content is included in AI context
- [ ] AI can answer detailed questions about forms

---

## Implementation Order

1. **Phase 1** (30 min) - Database migration
2. **Phase 2** (1 hr) - UI split with tabs
3. **Phase 3** (2 hrs) - Summary upload flow
4. **Phase 4** (1 hr) - Clickable citations
5. **Phase 5** (1.5 hrs) - Mistral OCR integration
6. **Phase 6** (1 hr) - Full document retrieval

**Total Estimated Time:** ~7 hours

---

## Environment Variables Required

```env
# Existing
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# New
MISTRAL_API_KEY=...
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                               │
├─────────────────────┬───────────────────────────────────────────┤
│  Info Documents     │  Forms/Notices                             │
│  (Chunked RAG)      │  (Summary-based)                          │
├─────────────────────┼───────────────────────────────────────────┤
│  Upload → Parse     │  Upload → OCR (Hindi) → Summarize         │
│  → Chunk → Embed    │  → Embed Summary → Store Full Path        │
│  → Store            │  → Store                                   │
└─────────────────────┴───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Database                             │
├─────────────────────────────────────────────────────────────────┤
│  files: { document_type: 'info'|'form', source_url, ... }       │
│  documents: { metadata: { is_summary, public_url, ... }, ... }  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Service (RAG)                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Vector search → Find relevant docs                          │
│  2. If is_summary → Fetch full document from storage            │
│  3. Format context with clickable citation links                │
│  4. AI responds with sources → User clicks to view full doc     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notes

- **Hindi Text Search**: OpenAI embeddings support multilingual search. A Hindi query will match Hindi document summaries effectively (~75-80% accuracy).
- **OCR Quality**: Mistral OCR returns markdown format, preserving tables and structure.
- **Cost Optimization**: Only embedding summaries (~500 words) instead of full documents saves embedding costs.
- **Fallback**: If OCR fails, fall back to standard parsing.
