"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { RecursiveChunker } from "@chonkiejs/core";

// Singleton chunker instance
let chunkerInstance: RecursiveChunker | null = null;
async function getChunker(): Promise<RecursiveChunker> {
  if (!chunkerInstance) {
    chunkerInstance = await RecursiveChunker.create({
      chunkSize: 256,
      minCharactersPerChunk: 24,
    });
  }
  return chunkerInstance;
}

export interface WebsiteContentResult {
  success: boolean;
  id?: string;
  chunkCount?: number;
  error?: string;
}

export interface WebsiteContentItem {
  id: string;
  title: string;
  source_url: string;
  content: string;
  created_at: string;
  college_id: string;
}

/**
 * Add scraped website content to the knowledge base
 * Uses Parent Document Retrieval pattern with source URL for citations
 */
export async function addWebsiteContent(
  collegeId: string,
  title: string,
  content: string,
  sourceUrl: string
): Promise<WebsiteContentResult> {
  try {
    if (!collegeId || !title || !content || !sourceUrl) {
      throw new Error(
        "Missing required fields: collegeId, title, content, or sourceUrl"
      );
    }

    if (content.trim().length < 20) {
      throw new Error("Content must be at least 20 characters");
    }

    // Validate URL format
    try {
      new URL(sourceUrl);
    } catch {
      throw new Error("Invalid source URL format");
    }

    console.log(`Adding website content: "${title}" from ${sourceUrl}`);

    // 1. Create file record with source_url for citations
    const { data: fileRecord, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        name: title,
        url: `website-content/${collegeId}/${Date.now()}`, // Virtual path
        college_id: collegeId,
        size: content.length,
        type: "text/markdown",
        document_type: "website", // New type for scraped website content
        source_url: sourceUrl, // This enables citations!
      })
      .select()
      .single();

    if (fileError) {
      throw new Error(`File record creation failed: ${fileError.message}`);
    }

    // 2. Create parent document with full content
    const { data: parentDoc, error: parentError } = await supabaseAdmin
      .from("parent_documents")
      .insert({
        file_id: fileRecord.id,
        content: content,
      })
      .select()
      .single();

    if (parentError) {
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(
        `Parent document creation failed: ${parentError.message}`
      );
    }

    // 3. Chunk the content using RecursiveChunker
    const chunker = await getChunker();
    const chunks = await chunker.chunk(content);

    console.log(`Created ${chunks.length} chunks for website content`);

    // 4. Generate embeddings and store chunks
    const chunkInserts = await Promise.all(
      chunks.map(async (chunk, index) => {
        // Enrich chunk with context for better matching
        // Include source info to help with retrieval
        const enrichedChunk = `Source: ${title}\nURL: ${sourceUrl}\n\n${chunk.text}`;

        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: enrichedChunk,
        });

        return {
          content: chunk.text,
          embedding,
          file_id: fileRecord.id,
          parent_document_id: parentDoc.id,
          metadata: {
            filename: title,
            college_id: collegeId,
            source_url: sourceUrl,
            is_website_content: true,
            chunk_index: index,
            total_chunks: chunks.length,
          },
        };
      })
    );

    const { error: dbError } = await supabaseAdmin
      .from("documents")
      .insert(chunkInserts);

    if (dbError) {
      await supabaseAdmin
        .from("parent_documents")
        .delete()
        .eq("id", parentDoc.id);
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    console.log(
      `Website content added: ${fileRecord.id} (${chunks.length} chunks)`
    );

    return {
      success: true,
      id: fileRecord.id,
      chunkCount: chunks.length,
    };
  } catch (error: unknown) {
    console.error("Website content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Get all website content entries for a college
 */
export async function getWebsiteContent(
  collegeId: string
): Promise<{ success: boolean; data?: WebsiteContentItem[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("files")
      .select("id, name, source_url, created_at, college_id")
      .eq("college_id", collegeId)
      .eq("document_type", "website")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Get content for each website entry from parent_documents
    const items: WebsiteContentItem[] = [];
    for (const file of data || []) {
      const { data: parentData } = await supabaseAdmin
        .from("parent_documents")
        .select("content")
        .eq("file_id", file.id)
        .single();

      items.push({
        id: file.id,
        title: file.name,
        source_url: file.source_url || "",
        content: parentData?.content || "",
        created_at: file.created_at,
        college_id: file.college_id,
      });
    }

    return { success: true, data: items };
  } catch (error: unknown) {
    console.error("Get website content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Delete website content by ID
 */
export async function deleteWebsiteContent(
  id: string
): Promise<WebsiteContentResult> {
  try {
    // Delete documents first (chunks)
    const { error: docError } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("file_id", id);

    if (docError) {
      console.warn("Document deletion warning:", docError.message);
    }

    // Delete parent documents
    const { error: parentError } = await supabaseAdmin
      .from("parent_documents")
      .delete()
      .eq("file_id", id);

    if (parentError) {
      console.warn("Parent document deletion warning:", parentError.message);
    }

    // Delete the file record
    const { error: fileError } = await supabaseAdmin
      .from("files")
      .delete()
      .eq("id", id);

    if (fileError) {
      throw new Error(`Delete failed: ${fileError.message}`);
    }

    console.log(`Website content deleted: ${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete website content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
