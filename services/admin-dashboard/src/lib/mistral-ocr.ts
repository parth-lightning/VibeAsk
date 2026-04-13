import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

/**
 * Process a document using Mistral OCR
 * Supports PDFs and images with Hindi text extraction
 *
 * @param fileUrl - Public URL of the document to process
 * @returns Extracted markdown text from all pages
 */
export async function extractTextWithOCR(fileUrl: string): Promise<string> {
  try {
    const result = await mistral.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: fileUrl,
      },
    });

    // Combine all pages' markdown content
    const fullText = result.pages
      .map((page) => page.markdown)
      .join("\n\n---\n\n");

    return fullText;
  } catch (error) {
    console.error("Mistral OCR error:", error);
    throw new Error(
      `OCR processing failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Process a document using Mistral OCR with base64 data
 * Useful for files that aren't publicly accessible yet
 *
 * @param base64Data - Base64 encoded file data
 * @param mimeType - MIME type of the file (e.g., 'application/pdf', 'image/jpeg')
 * @returns Extracted markdown text from all pages
 */
export async function extractTextWithOCRBase64(
  base64Data: string,
  mimeType: string
): Promise<string> {
  try {
    // Mistral OCR requires a URL, so we need to use data URI for base64
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const result = await mistral.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "image_url",
        imageUrl: dataUri,
      },
    });

    // Combine all pages' markdown content
    const fullText = result.pages
      .map((page) => page.markdown)
      .join("\n\n---\n\n");

    return fullText;
  } catch (error) {
    console.error("Mistral OCR error:", error);
    throw new Error(
      `OCR processing failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
