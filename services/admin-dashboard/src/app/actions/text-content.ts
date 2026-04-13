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

export interface TextContentResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface TextContentItem {
  id: string;
  title: string;
  content: string;
  created_at: string;
  college_id: string;
}

/**
 * Add text content directly to the knowledge base
 * Uses Parent Document Retrieval: stores full content as parent,
 * creates small chunks for embedding/matching
 */
export async function addTextContent(
  collegeId: string,
  title: string,
  content: string
): Promise<TextContentResult> {
  try {
    if (!collegeId || !title || !content) {
      throw new Error("Missing required fields: collegeId, title, or content");
    }

    if (content.trim().length < 20) {
      throw new Error("Content must be at least 20 characters");
    }

    console.log(`Adding text content: "${title}" for college: ${collegeId}`);

    // 1. Create a virtual file record for consistency
    const { data: fileRecord, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        name: title,
        url: `text-content/${collegeId}/${Date.now()}`, // Virtual path
        college_id: collegeId,
        size: content.length,
        type: "text/plain",
        document_type: "text", // New type for text content
        source_url: null, // No source URL for raw text content
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

    // 4. Generate embeddings and store chunks
    const chunkInserts = await Promise.all(
      chunks.map(async (chunk, index) => {
        // Enrich chunk with context for better matching
        const enrichedChunk = `Document: ${title}\nType: text\n\n${chunk.text}`;

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
            is_text_content: true,
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
      // Rollback parent document and file record
      await supabaseAdmin
        .from("parent_documents")
        .delete()
        .eq("id", parentDoc.id);
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    console.log(
      `Text content added successfully: ${fileRecord.id} (${chunks.length} chunks)`
    );

    return {
      success: true,
      id: fileRecord.id,
    };
  } catch (error: unknown) {
    console.error("Text content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Get all text content entries for a college
 */
export async function getTextContent(
  collegeId: string
): Promise<{ success: boolean; data?: TextContentItem[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("files")
      .select("id, name, created_at, college_id")
      .eq("college_id", collegeId)
      .eq("document_type", "text")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Get content for each text entry from parent_documents
    const items: TextContentItem[] = [];
    for (const file of data || []) {
      const { data: parentData } = await supabaseAdmin
        .from("parent_documents")
        .select("content")
        .eq("file_id", file.id)
        .single();

      items.push({
        id: file.id,
        title: file.name,
        content: parentData?.content || "",
        created_at: file.created_at,
        college_id: file.college_id,
      });
    }

    return { success: true, data: items };
  } catch (error: unknown) {
    console.error("Get text content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Delete text content by ID
 * Removes documents, parent_documents, and files records
 */
export async function deleteTextContent(
  id: string
): Promise<TextContentResult> {
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

    console.log(`Text content deleted: ${id}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete text content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
