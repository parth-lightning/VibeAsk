import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export async function parseFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = file.type;

  if (type === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } else if (
    type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (type === "text/plain") {
    return buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${type}`);
  }
}
