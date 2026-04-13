import {
  streamText,
  type ModelMessage,
  stepCountIs,
  createUIMessageStream,
  generateObject,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { logger } from "../lib/utils/logger";
import { createRAGTools } from "../lib/ai/tools";
import { SYSTEM_PROMPT } from "../lib/ai/prompts";

export interface ChatOptions {
  messages: ModelMessage[];
  collegeId?: string;
  email?: string;
}

/**
 * Generate follow-up suggestions in parallel
 * Uses a separate, cheaper model for fast generation
 */
async function generateSuggestions(
  messages: ModelMessage[],
  userLanguage: string = "English"
): Promise<string[]> {
  try {
    // Get the last few messages for context
    const recentMessages = messages.slice(-4);
    const context = recentMessages
      .map(
        (m) =>
          `${m.role}: ${
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content)
          }`
      )
      .join("\n");

    const { object } = await generateObject({
      model: openai("gpt-4o"), // Fast, cheap model
      schema: z.object({
        suggestions: z
          .array(z.string())
          .max(3)
          .describe("Follow-up question suggestions the user might ask"),
      }),
      prompt: `You are generating follow-up questions that naturally extend the current conversation.

Based on this conversation:
${context}

Generate 2-3 follow-up questions that the USER would likely ask next to dig deeper or explore related topics.

CRITICAL RULES:
1. **Questions are from USER's perspective** - what they want to know next
2. **Build on the conversation** - extend the current topic or explore natural next steps
3. **Be SPECIFIC and ACTIONABLE** - avoid generic questions
4. **College-only topics:** admissions, fees, courses, faculty, hostel, placements, exams, results, events, facilities
5. **Include clarifying questions** if the AI needs more details (year, branch, etc.) to give better answers
6. Generate in ${userLanguage} language
7. Keep under 60 characters per question
8. Questions should feel like a natural continuation of the dialogue

Example GOOD suggestions (specific, actionable, user-perspective):
After discussing admission process:
- "What documents are required for admission?"
- "When is the last date to apply?"
- "What is the fee structure for my course?"

After discussing fees generally:
- "What are the fees for 2nd year Mechanical?"
- "Is there a scholarship for SC/ST students?"
- "Can I pay fees in installments?"

After discussing hostel:
- "What facilities are available in the hostel?"
- "How do I apply for hostel accommodation?"
- "What is the hostel mess menu like?"

Example BAD suggestions (avoid these):
- "What else can I help with?" (too generic)
- "Do you have more questions?" (not specific)
- "Tell me about yourself" (not college-related)
- "What information do you need?" (AI asking user)

Generate 2-3 natural follow-up questions:`,
    });

    return object.suggestions;
  } catch (error) {
    logger.error("Failed to generate suggestions:", error);
    return [];
  }
}

/**
 * Detect user's language from the last message
 */
function detectLanguage(messages: ModelMessage[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMessage) return "English";

  const content =
    typeof lastUserMessage.content === "string" ? lastUserMessage.content : "";

  // Simple detection based on script
  if (/[\u0900-\u097F]/.test(content)) return "Hindi";
  if (/[\u0B80-\u0BFF]/.test(content)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(content)) return "Telugu";
  if (/[\u0980-\u09FF]/.test(content)) return "Bengali";
  if (/[\u0A80-\u0AFF]/.test(content)) return "Gujarati";
  if (/[\u0C80-\u0CFF]/.test(content)) return "Kannada";
  if (/[\u0D00-\u0D7F]/.test(content)) return "Malayalam";
  if (/[\u0A00-\u0A7F]/.test(content)) return "Punjabi";
  if (/[\u0B00-\u0B7F]/.test(content)) return "Odia";

  return "English";
}

/**
 * Create a streaming chat response using Vercel AI SDK v5
 * Uses parallel streaming: main response + suggestions generated concurrently
 *
 * @param options Chat configuration options
 * @returns UIMessageStream that streams both response and suggestions
 */
export function createChatStream(options: ChatOptions) {
  const { messages, collegeId, email } = options;

  // Select model based on environment
  const useGemini = process.env.USE_GEMINI === "true";
  const model = useGemini
    ? google("gemini-2.0-flash-exp")
    : openai("gpt-5-mini-2025-08-07");

  logger.info(`Using ${useGemini ? "Google Gemini" : "OpenAI GPT-4.1"} model`);
  if (collegeId) {
    logger.info(`RAG enabled for college: ${collegeId}`);
  }

  // RAG tools only (no suggestion tool - we handle suggestions separately)
  const tools = collegeId ? createRAGTools(collegeId, email) : {};

  // Detect user language for suggestions
  const userLanguage = detectLanguage(messages);

  // Create a combined stream with parallel execution
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Start BOTH in parallel
      logger.info("Starting parallel streams: main response + suggestions");

      // 1. Main AI response stream
      const mainResult = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages,
        tools,
        toolChoice: "auto",
        stopWhen: stepCountIs(5),
        onError: (error) => {
          logger.error("Main stream error:", error);
        },
        onFinish: ({ finishReason, usage, text }) => {
          logger.info("Main stream finished", { finishReason, usage });
          // Log the raw AI response text to check formatting
          console.log("\n========== RAW AI RESPONSE ==========");
          console.log(text);
          console.log("=====================================\n");
        },
      });

      // 2. Start suggestion generation immediately (in parallel)
      const suggestionsPromise = generateSuggestions(messages, userLanguage);
      logger.info("Suggestions generation started in parallel");

      // Merge the main response stream to the client
      writer.merge(mainResult.toUIMessageStream({ sendFinish: false }));

      // Wait for both to complete
      const [_, suggestions] = await Promise.all([
        mainResult.response, // Wait for main stream to complete
        suggestionsPromise, // Wait for suggestions
      ]);

      logger.info("Suggestions ready", { count: suggestions.length });

      // Write suggestions as a custom data part
      if (suggestions.length > 0) {
        writer.write({
          type: "data-suggestions",
          data: { suggestions },
        });
        logger.info("Suggestions written to stream");
      }
    },
    onError: (error) => {
      logger.error("Stream execution error:", error);
      return "An error occurred. Please try again.";
    },
  });

  return stream;
}
