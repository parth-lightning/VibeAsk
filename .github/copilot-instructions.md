# Agnostic Chatbot - Copilot Instructions

## Project Overview

Multi-tenant academic counseling platform for Indian polytechnic colleges (SIH hackathon). Features text chat, voice calls, and admin dashboard with RAG-based document retrieval.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Widget (Vite)  │────▶│ AI Service (Node)│────▶│    Supabase    │
│  React + TS     │     │ Express + Vercel │     │ pgvector + RLS │
└────────┬────────┘     │   AI SDK v5      │     └────────────────┘
         │              └────────┬─────────┘
         │                       │
         │              ┌────────▼─────────┐
         └─────────────▶│  Voice Agent     │
           (LiveKit)    │  Python/LiveKit  │
                        └──────────────────┘
```

### Service Boundaries

- **widget/** (`services/widget`): Embeddable React widget, Vite build, deployed to Vercel CDN
- **ai-service/** (`services/ai-service`): Express.js API, Vercel AI SDK v5, deployed to Heroku
- **voice-agent/** (`services/voice-agent`): Python LiveKit agent, deployed separately
- **admin-dashboard/** (`services/admin-dashboard`): Next.js 16 admin panel for document uploads

## Key Patterns

### RAG Flow (Parent Document Retrieval)

1. Documents chunked via `RecursiveChunker` (~256 tokens) in `admin-dashboard/src/app/actions/upload-document.ts`
2. Chunks stored with embeddings, linked to `parent_documents` table for full context
3. Search matches chunks → returns full parent content for LLM context
4. See `ai-service/src/lib/rag/search.ts` for the vector search implementation

### Multi-tenancy via `collegeId`

Every request includes `collegeId` to scope data:

```typescript
// Widget passes collegeId in chat requests
body: { collegeId: config?.collegeId, sessionId: getSessionId() }

// AI tools filter by collegeId
filter: { college_id: collegeId }
```

### Vercel AI SDK v5 Patterns

- Use `streamText`, `createUIMessageStream`, `generateObject` from `ai`
- Tools defined with `tool()` from `ai` package with Zod schemas
- Model switching: `process.env.USE_GEMINI === "true"` toggles OpenAI/Gemini
- See `ai-service/src/lib/ai/chat.ts` and `ai-service/src/lib/ai/tools.ts`

### Voice Integration (LiveKit)

- Widget requests token from `/api/voice/token` → connects to LiveKit room
- Python agent (`voice-agent/src/agent.py`) joins room, handles STT/TTS
- Agent has same RAG tools as text chat via `@function_tool` decorator
- Transcripts sent via LiveKit data channel for unified history

## Development Commands

```bash
# AI Service (from services/ai-service)
npm run dev          # tsx watch mode on port 3000

# Widget (from services/widget)
npm run dev          # Vite dev server
npm run build        # Production build for CDN

# Admin Dashboard (from services/admin-dashboard)
npm run dev          # Next.js dev server

# Voice Agent (from services/voice-agent)
uv run python src/agent.py dev  # Local development
```

## Environment Variables

### ai-service

```
OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
EXA_API_KEY (for web search fallback)
USE_GEMINI=true (optional: switch to Gemini)
```

### widget

```
VITE_USE_PRODUCTION_API=false (for local dev)
VITE_COLLEGE_ID=demo-college
```

## Database Schema (Supabase)

Key tables in `admin-dashboard/supabase/schema.sql`:

- `files`: Document metadata with `source_url` for citations
- `documents`: Chunks with `vector(1536)` embeddings
- `parent_documents`: Full document content for LLM context
- `conversations`: Keyed by widget `sessionId`, shared by text+voice
- `messages`: Encrypted (`content_encrypted`, `content_iv`, `content_tag`)

## Code Conventions

- ESM everywhere (`"type": "module"` in package.json, `.js` imports in TypeScript)
- Server actions in Next.js use `"use server"` directive
- shadcn/ui components in all frontend services (pre-configured)
- Zod for all API/tool schemas
- Messages encrypted at rest using AES-GCM (see `ai-service/src/lib/utils/encryption.js`)

## Important Implementation Notes

- Tool queries must be in **English** even if user speaks Hindi/Tamil - translate before search
- Voice agent spells out numbers for TTS ("twenty twenty-four" not "2024")
- Widget uses `sessionId` as conversation ID for both text and voice continuity
- Colleges defined in `admin-dashboard/src/lib/colleges.ts` - slug used as `collegeId`
