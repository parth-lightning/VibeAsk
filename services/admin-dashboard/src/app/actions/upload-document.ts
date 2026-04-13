"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { parseFile } from "@/lib/parser";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { RecursiveChunker } from "@chonkiejs/core";

// Singleton chunker instance
let chunkerInstance: RecursiveChunker | null = null;

async function getChunker(): Promise<RecursiveChunker> {
  if (!chunkerInstance) {
    chunkerInstance = await RecursiveChunker.create({
      chunkSize: 256, // ~256 tokens per chunk
      minCharactersPerChunk: 24,
    });
  }
  return chunkerInstance;
}

export async function uploadDocument(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const collegeId = formData.get("collegeId") as string;

    if (!file || !collegeId) {
      throw new Error("Missing file or college ID");
    }

    console.log(`Processing file: ${file.name} for college: ${collegeId}`);

    // 1. Upload to Supabase Storage
    const filePath = `${collegeId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // 2. Parse File to get text content
    const text = await parseFile(file);
    console.log(`Extracted ${text.length} characters`);

    // Get public URL for clickable citations
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // 3. Create the file record first
    const { data: fileRecord, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        name: file.name,
        url: filePath,
        college_id: collegeId,
        size: file.size,
        type: file.type,
        document_type: "info",
        source_url: publicUrl,
      })
      .select()
      .single();

    if (fileError) {
      throw new Error(`File record creation failed: ${fileError.message}`);
    }

    // 4. Create parent document (full content)
    const { data: parentDoc, error: parentError } = await supabaseAdmin
      .from("parent_documents")
      .insert({
        file_id: fileRecord.id,
        content: text,
      })
      .select()
      .single();

    if (parentError) {
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(
        `Parent document creation failed: ${parentError.message}`
      );
    }

    // 5. Chunk text using RecursiveChunker
    const chunker = await getChunker();
    const chunks = await chunker.chunk(text);
    console.log(`Created ${chunks.length} chunks using RecursiveChunker`);

    // 6. Generate embeddings with enrichment for each chunk
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        // Enrichment: Prepend context for better retrieval
        const enrichedText = `Document: ${file.name}\nType: info\n\n${chunk.text}`;

        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: enrichedText,
        });

        return {
          content: chunk.text,
          embedding,
          parent_document_id: parentDoc.id,
          file_id: fileRecord.id,
          metadata: {
            filename: file.name,
            college_id: collegeId,
            source_url: publicUrl,
            document_type: "info",
            chunk_index: index,
          },
        };
      })
    );

    // 7. Batch insert chunks
    const { error: dbError } = await supabaseAdmin
      .from("documents")
      .insert(chunksWithEmbeddings);

    if (dbError) {
      // Rollback
      await supabaseAdmin
        .from("parent_documents")
        .delete()
        .eq("id", parentDoc.id);
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    return {
      success: true,
      message: `Document processed: ${chunks.length} chunks created`,
    };
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
