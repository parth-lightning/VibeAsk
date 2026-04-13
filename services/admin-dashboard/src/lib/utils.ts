import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    let chunk = text.slice(start, end);

    // Try to break at a newline or space if possible
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(" ");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakPoint = Math.max(lastSpace, lastNewline);

      if (breakPoint > chunkSize * 0.8) {
        // Only break if it's near the end
        chunk = chunk.slice(0, breakPoint);
        start += breakPoint + 1 - overlap;
      } else {
        start += chunkSize - overlap;
      }
    } else {
      start += chunkSize - overlap;
    }

    chunks.push(chunk.trim());
  }

  return chunks;
}
