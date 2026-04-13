import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { logger } from "../utils/logger.js";
import { getSupabase } from "./supabase.js";

export interface SearchResult {
  id: string; // UUID
  content: string; // Matched chunk content
  metadata: {
    filename: string;
    college_id: string;
    chunk_index?: number;
    source_url?: string | null; // Clickable citation link
    document_type?: "info" | "structured" | "text" | "website";
  };
  similarity: number;
  parent_content: string; // Full document content for LLM context
  source_url: string | null; // Citation link (fetched from files table)
}

/**
 * Search college documents using vector similarity
 * @param query - Natural language query
 * @param collegeId - College identifier to filter results
 * @param matchThreshold - Minimum similarity score (0-1)
 * @param matchCount - Maximum results to return
 */
export async function searchDocuments(
  query: string,
  collegeId: string,
  matchThreshold = 0.3,
  matchCount = 20 //TODO : change  while giving demos to 20
): Promise<SearchResult[]> {
  try {
    // 1. Generate query embedding using OpenAI
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: query,
    });

    // 2. Get Supabase client
    const supabase = getSupabase();

    // 3. Convert embedding array to PostgreSQL vector string format
    const vectorString = `[${embedding.join(",")}]`;

    // 4. Call Supabase RPC function for vector similarity search
    // Now returns parent_content and file_id
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding_text: vectorString,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter: { college_id: collegeId },
    });

    if (error) {
      logger.error("Supabase RPC error:", error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    if (!data || !Array.isArray(data)) {
      logger.warn("RPC returned no data or invalid format");
      return [];
    }

    // 5. Enrich results with source_url from files table
    const enrichedResults = await Promise.all(
      data.map(
        async (result: {
          id: string;
          content: string;
          metadata: Record<string, unknown>;
          similarity: number;
          parent_content: string;
          file_id: string | null;
        }) => {
          let source_url: string | null = null;

          // Fetch source_url from files table if file_id exists
          if (result.file_id) {
            const { data: file } = await supabase
              .from("files")
              .select("source_url")
              .eq("id", result.file_id)
              .single();
            source_url = file?.source_url || null;
          }

          return {
            id: result.id,
            content: result.content,
            metadata: result.metadata as SearchResult["metadata"],
            similarity: result.similarity,
            parent_content: result.parent_content,
            source_url,
          };
        }
      )
    );

    // Log similarity scores for debugging
    if (enrichedResults.length > 0) {
      logger.info(
        `Found ${enrichedResults.length} matching documents for college ${collegeId}:`,
        enrichedResults.map((r) => ({
          filename: r.metadata.filename,
          similarity: (r.similarity * 100).toFixed(1) + "%",
          has_parent: r.parent_content !== r.content,
        }))
      );
    } else {
      logger.info(
        `Found 0 matching documents for college ${collegeId} (threshold: ${matchThreshold})`
      );
    }

    return enrichedResults;
  } catch (error) {
    logger.error("Document search error:", error);
    throw error;
  }
}

/**
 * Format search results into context string for LLM
 * Uses parent_content (full document) instead of chunk content
 * Includes clickable citation links when available
 * Deduplicates by parent document to avoid sending same content multiple times
 */
export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No relevant documents found in the college's knowledge base.";
  }

  // Deduplicate by parent_content to avoid repeating the same document
  // Multiple chunks can point to the same parent document
  const seenParents = new Map<string, SearchResult>();

  for (const result of results) {
    // Create a unique key for each parent document
    // Using file_id or parent_content hash as key
    const parentKey = result.parent_content;

    // Keep the result with highest similarity if we've seen this parent before
    const existing = seenParents.get(parentKey);
    if (!existing || result.similarity > existing.similarity) {
      seenParents.set(parentKey, result);
    }
  }

  const uniqueResults = Array.from(seenParents.values());

  // Log deduplication info
  if (uniqueResults.length < results.length) {
    logger.info(
      `Deduplicated ${results.length} chunk results to ${uniqueResults.length} unique parent documents`
    );
  }

  // Sort by similarity (highest first)
  uniqueResults.sort((a, b) => b.similarity - a.similarity);

  const formattedDocs: string[] = [];

  for (const result of uniqueResults) {
    const filename = result.metadata.filename;
    const sourceUrl = result.source_url;
    const docType = result.metadata.document_type || "info";

    // Create source citation - with link if available
    const source = sourceUrl ? `[${filename}](${sourceUrl})` : filename;

    // Use full parent_content without truncation
    const contentToUse = result.parent_content;

    // Document type label
    const typeLabel =
      docType === "structured"
        ? "📄 Form/Notice"
        : docType === "text"
        ? "📝 Text Content"
        : "📚 Information";

    const formattedDoc = `
${typeLabel} - Document (Source: ${source}):
${contentToUse}
(Relevance: ${(result.similarity * 100).toFixed(1)}%)
---
    `.trim();

    formattedDocs.push(formattedDoc);
  }

  logger.info(
    `Formatted ${
      formattedDocs.length
    } unique documents for context (total chars: ${
      formattedDocs.join("\n\n").length
    })`
  );

  return formattedDocs.join("\n\n");
}
