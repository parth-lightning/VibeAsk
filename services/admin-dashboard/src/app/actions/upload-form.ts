"use server";

import { supabaseAdmin } from "@/lib/supabase";
import { parseFile } from "@/lib/parser";
import { extractTextWithOCR } from "@/lib/mistral-ocr";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { RecursiveChunker } from "@chonkiejs/core";

/**
 * Upload Form/Notice Action
 *
 * This action handles uploading forms and notices using Parent Document Retrieval:
 * 1. Server generates a signed upload URL
 * 2. Client uploads directly to Supabase Storage using signed URL
 * 3. Server processes: text extraction (with optional OCR via Mistral)
 * 4. Content is chunked using RecursiveChunker and embedded
 * 5. Full content stored in parent_documents, chunks in documents
 * 6. When matched in RAG, the full parent document is retrieved for AI context
 */

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

export interface UploadFormResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  error?: string;
}

export interface SignedUploadUrlResult {
  success: boolean;
  signedUrl?: string;
  token?: string;
  filePath?: string;
  publicUrl?: string;
  error?: string;
}

export interface ProcessFormInput {
  filePath: string;
  publicUrl: string;
  collegeId: string;
  title: string;
  useOcr: boolean;
  fileType: string;
  fileSize: number;
}

/**
 * Create a signed upload URL for client-side upload
 * This bypasses RLS since it uses the admin client
 */
export async function createSignedUploadUrl(
  collegeId: string,
  fileName: string
): Promise<SignedUploadUrlResult> {
  try {
    const filePath = `${collegeId}/forms/${Date.now()}-${fileName}`;

    // Create signed upload URL (valid for 60 seconds)
    const { data, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      throw new Error(
        `Failed to create signed URL: ${error?.message || "Unknown error"}`
      );
    }

    // Get public URL for the file (will be accessible after upload)
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(filePath);

    return {
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      filePath,
      publicUrl: urlData.publicUrl,
    };
  } catch (error: unknown) {
    console.error("Signed URL creation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Process an already-uploaded form from Supabase Storage
 * Uses Parent Document Retrieval: stores full content + searchable chunks
 */
export async function processUploadedForm(
  input: ProcessFormInput
): Promise<UploadFormResult> {
  try {
    const {
      filePath,
      publicUrl,
      collegeId,
      title,
      useOcr,
      fileType,
      fileSize,
    } = input;

    console.log(`Processing form: ${title} for college: ${collegeId}`);
    console.log(`File path: ${filePath}`);

    // 1. Download the file from Supabase Storage to process
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(
        `Failed to download file: ${downloadError?.message || "No data"}`
      );
    }

    // 2. Extract text from the document
    let extractedText: string;

    if (useOcr) {
      // Use Mistral OCR for Hindi PDFs and scanned documents
      console.log("Using Mistral OCR for text extraction...");
      extractedText = await extractTextWithOCR(publicUrl);
    } else {
      // Use standard parser for regular documents
      console.log("Using standard parser for text extraction...");
      const file = new File([fileData], title, { type: fileType });
      extractedText = await parseFile(file);
    }

    console.log(`Extracted ${extractedText.length} characters`);

    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error(
        "Could not extract sufficient text from the document. Try enabling OCR."
      );
    }

    // 3. Create file record
    const { data: fileRecord, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        name: title,
        url: filePath,
        college_id: collegeId,
        size: fileSize,
        type: fileType,
        document_type: "structured",
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
        content: extractedText,
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
    const chunks = await chunker.chunk(extractedText);
    console.log(`Created ${chunks.length} chunks using RecursiveChunker`);

    // 6. Generate embeddings with enrichment
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const enrichedText = `Document: ${title}\nType: structured\n\n${chunk.text}`;

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
            filename: title,
            college_id: collegeId,
            source_url: publicUrl,
            document_type: "structured",
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
      await supabaseAdmin
        .from("parent_documents")
        .delete()
        .eq("id", parentDoc.id);
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    console.log(
      `Form uploaded successfully: ${fileRecord.id} with ${chunks.length} chunks`
    );

    return {
      success: true,
      fileId: fileRecord.id,
      publicUrl: publicUrl,
    };
  } catch (error: unknown) {
    console.error("Form processing error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * @deprecated Use client-side upload with processUploadedForm instead
 * This function is kept for backwards compatibility but will hit body size limits
 */
export async function uploadForm(
  formData: FormData
): Promise<UploadFormResult> {
  try {
    const file = formData.get("file") as File;
    const collegeId = formData.get("collegeId") as string;
    const title = formData.get("title") as string | null;
    const useOcr = formData.get("useOcr") === "true";

    if (!file || !collegeId) {
      throw new Error("Missing file or college ID");
    }

    const documentTitle = title || file.name;
    console.log(`Processing form: ${documentTitle} for college: ${collegeId}`);

    // 1. Upload to Supabase Storage
    const filePath = `${collegeId}/forms/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("documents").getPublicUrl(filePath);

    console.log(`File uploaded to: ${publicUrl}`);

    // 2. Extract text from the document
    let extractedText: string;

    if (useOcr) {
      console.log("Using Mistral OCR for text extraction...");
      extractedText = await extractTextWithOCR(publicUrl);
    } else {
      console.log("Using standard parser for text extraction...");
      extractedText = await parseFile(file);
    }

    console.log(`Extracted ${extractedText.length} characters`);

    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error(
        "Could not extract sufficient text from the document. Try enabling OCR."
      );
    }

    // 3. Create file record
    const { data: fileRecord, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        name: documentTitle,
        url: filePath,
        college_id: collegeId,
        size: file.size,
        type: file.type,
        document_type: "structured",
        source_url: publicUrl,
      })
      .select()
      .single();

    if (fileError) {
      throw new Error(`File record creation failed: ${fileError.message}`);
    }

    // 4. Create parent document
    const { data: parentDoc, error: parentError } = await supabaseAdmin
      .from("parent_documents")
      .insert({
        file_id: fileRecord.id,
        content: extractedText,
      })
      .select()
      .single();

    if (parentError) {
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(
        `Parent document creation failed: ${parentError.message}`
      );
    }

    // 5. Chunk and embed
    const chunker = await getChunker();
    const chunks = await chunker.chunk(extractedText);

    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const enrichedText = `Document: ${documentTitle}\nType: structured\n\n${chunk.text}`;
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
            filename: documentTitle,
            college_id: collegeId,
            source_url: publicUrl,
            document_type: "structured",
            chunk_index: index,
          },
        };
      })
    );

    const { error: dbError } = await supabaseAdmin
      .from("documents")
      .insert(chunksWithEmbeddings);

    if (dbError) {
      await supabaseAdmin
        .from("parent_documents")
        .delete()
        .eq("id", parentDoc.id);
      await supabaseAdmin.from("files").delete().eq("id", fileRecord.id);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    console.log(
      `Form uploaded successfully: ${fileRecord.id} with ${chunks.length} chunks`
    );

    return {
      success: true,
      fileId: fileRecord.id,
      publicUrl: publicUrl,
    };
  } catch (error: unknown) {
    console.error("Form upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
