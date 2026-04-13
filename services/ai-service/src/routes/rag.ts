import { Router, Request, Response } from "express";
import { searchDocuments, formatContext } from "../lib/rag/search.js";
import { logger } from "../lib/utils/logger.js";

export const ragRouter = Router();

/**
 * POST /api/rag/search
 *
 * Search endpoint that returns RAG chunks without AI processing.
 * Useful for external integrations (n8n, Telegram bots, etc.) that
 * want to use their own LLM for processing.
 *
 * Request body:
 * {
 *   "query": "What are the admission requirements?",
 *   "collegeId": "gpc-barmer",
 *   "matchThreshold": 0.3,  // optional, default 0.3
 *   "matchCount": 5         // optional, default 5
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "query": "...",
 *   "collegeId": "...",
 *   "resultCount": 3,
 *   "context": "Formatted context string for LLM...",
 *   "documents": [
 *     {
 *       "id": "uuid",
 *       "filename": "Admission Policy.pdf",
 *       "documentType": "structured",
 *       "content": "chunk content...",
 *       "parentContent": "full document content...",
 *       "sourceUrl": "https://...",
 *       "similarity": 0.89
 *     }
 *   ]
 * }
 */
ragRouter.post("/search", async (req: Request, res: Response) => {
  try {
    const { query, collegeId, matchThreshold = 0.3, matchCount = 5 } = req.body;

    // Validate required fields
    if (!query || typeof query !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'query' field. Must be a non-empty string.",
      });
      return;
    }

    if (!collegeId || typeof collegeId !== "string") {
      res.status(400).json({
        success: false,
        error:
          "Missing or invalid 'collegeId' field. Must be a non-empty string.",
      });
      return;
    }

    logger.info(`RAG search request: query="${query}", collegeId=${collegeId}`);

    // Perform vector search
    const results = await searchDocuments(
      query,
      collegeId,
      matchThreshold,
      matchCount
    );

    // Format context for LLM consumption
    const context = formatContext(results);

    // Return structured response
    const response = {
      success: true,
      query,
      collegeId,
      resultCount: results.length,
      // Pre-formatted context string ready for LLM
      context,
      // Individual documents for custom processing
      documents: results.map((r) => ({
        id: r.id,
        filename: r.metadata.filename,
        documentType: r.metadata.document_type || "info",
        content: r.content,
        parentContent: r.parent_content,
        sourceUrl: r.source_url,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
    };

    logger.info(
      `RAG search completed: ${results.length} results for collegeId=${collegeId}`
    );

    res.json(response);
  } catch (error) {
    logger.error("RAG search error:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});

/**
 * GET /api/rag/health
 * Health check for the RAG endpoint
 */
ragRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    endpoint: "rag",
    timestamp: new Date().toISOString(),
  });
});
