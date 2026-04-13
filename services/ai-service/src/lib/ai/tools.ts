import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { searchDocuments, formatContext } from "../rag/search.js";
import { logger } from "../utils/logger.js";
import { getCollegeNameById } from "../utils/colleges.js";
import { getSupabase } from "../rag/supabase.js";

// Lazy initialization of Exa client (env vars loaded at runtime)
let exaClient: Exa | null = null;
function getExaClient(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

/**
 * Create RAG tools for the AI chat
 * @param collegeId - College identifier for scoped search
 * @param userEmail - User email for knowledge gap notifications
 */
export function createRAGTools(collegeId?: string, userEmail?: string) {
  const collegeName = collegeId ? getCollegeNameById(collegeId) : undefined;

  return {
    searchDocuments: tool({
      description: `Search through college documents, policies, announcements, and FAQs to find relevant information.

Use this tool when you need specific information about:
- Admission requirements and procedures
- Academic programs and courses  
- Fee structures and payment policies
- Campus facilities and services
- Important dates and deadlines
- Scholarships and financial aid
- Student services and resources
- General college information

IMPORTANT: 
- Always use this tool before answering questions about college-specific information. Do not make up or guess information.
- CRITICAL: The query parameter MUST ALWAYS be in ENGLISH, regardless of the user's language. If the user asks in Hindi/Tamil/Telugu/etc, translate the query to English first before calling this tool.`,
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "The search query in ENGLISH. If the user's question is in another language, translate it to English first. Be specific and descriptive."
          ),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          if (!collegeId) {
            return {
              success: false,
              message:
                "College ID not provided. Cannot search documents. Please ask the user to specify their college.",
              documents: [],
            };
          }

          const results = await searchDocuments(query, collegeId);

          if (results.length === 0) {
            return {
              success: true,
              message:
                "No relevant documents found for this query. You can try a different search query, or use webSearch tool to find information from the web.",
              context: "",
              documents: [],
            };
          }

          const context = formatContext(results);

          return {
            success: true,
            message: `Found ${results.length} relevant document(s).`,
            context,
            documents: results.map((r) => ({
              filename: r.metadata.filename,
              similarity: Math.round(r.similarity * 100),
              preview: r.content.substring(0, 100) + "...",
            })),
          };
        } catch (error) {
          logger.error("Tool execution error:", error);
          return {
            success: false,
            message:
              error instanceof Error
                ? `Search failed: ${error.message}`
                : "An unknown error occurred during search",
            documents: [],
          };
        }
      },
    }),

    webSearch: tool({
      description: `Search the web for real-time information about the college.

CRITICAL RULES:
- ONLY use this tool when searchDocuments returns documents=[] (empty array)
- DO NOT use this tool if searchDocuments found any results
- The college name will be automatically prepended to your query for better results

Use this for:
- General information about the college not in uploaded documents
- Recent news or updates about the college
- Comparison with other institutions
- Government policies related to polytechnic education`,
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search query in ENGLISH. Be specific and descriptive. Examples: 'hostel fees accommodation 2025', 'placement statistics companies', 'admission eligibility criteria'"
          ),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          // Prepend college name for better search context
          const searchQuery = collegeName
            ? `${collegeName} Rajasthan ${query}`
            : query;

          logger.info(`Web search query: ${searchQuery}`);

          const exa = getExaClient();
          const { results } = await exa.searchAndContents(searchQuery, {
            numResults: 2, // Keep low to save Exa credits
            type: "auto", // Let Exa choose between neural/keyword search
            text: { maxCharacters: 800 }, // Limit content length at API level
          });

          if (!results || results.length === 0) {
            return {
              success: true,
              message: "No relevant web results found for this query.",
              sources: [],
            };
          }

          return {
            success: true,
            message: `Found ${results.length} web source(s).`,
            sources: results.map((r) => ({
              title: r.title || "Untitled",
              url: r.url,
              content: r.text || "", // Already limited to 800 chars by API
              publishedDate: r.publishedDate || null,
            })),
          };
        } catch (error) {
          logger.error("Web search error:", error);
          return {
            success: false,
            message:
              error instanceof Error
                ? `Web search failed: ${error.message}`
                : "An unknown error occurred during web search",
            sources: [],
          };
        }
      },
    }),

    logKnowledgeGap: tool({
      description: `Log a knowledge gap when you cannot fully answer a college-related question from the documents.

**IMPORTANT: ALWAYS call this tool when:**
- searchDocuments returns results but they don't contain the specific information asked
- You have to say "I could not find" or "information not available" in your response
- The user asks about cutoffs, specific fees, faculty names, schedules, or other specific data not in documents
- You're about to use webSearch because RAG didn't answer the question

DO NOT use for:
- Off-topic questions (weather, general trivia, jokes, etc.)
- Questions you successfully answered from the documents
- Vague or unclear questions that need clarification
- Greetings or casual conversation`,
      inputSchema: z.object({
        originalQuery: z
          .string()
          .describe("The user's original question exactly as they asked it"),
        aiComment: z
          .string()
          .describe(
            "Brief explanation of what information is missing and why it would be helpful for students"
          ),
      }),
      execute: async ({
        originalQuery,
        aiComment,
      }: {
        originalQuery: string;
        aiComment: string;
      }) => {
        try {
          if (!collegeId) {
            return {
              success: false,
              message: "Cannot log knowledge gap without college context",
            };
          }

          const supabase = getSupabase();

          const { error } = await supabase.from("knowledge_gaps").insert({
            query: originalQuery,
            ai_comment: aiComment,
            college_id: collegeId,
            user_email: userEmail || null,
          });

          if (error) {
            logger.error("Failed to log knowledge gap:", error);
            return { success: false, message: "Failed to log knowledge gap" };
          }

          logger.info("Knowledge gap logged", {
            query: originalQuery,
            collegeId,
          });
          return {
            success: true,
            message:
              "Knowledge gap has been logged for the admin to review and add to the knowledge base",
          };
        } catch (error) {
          logger.error("Knowledge gap tool error:", error);
          return { success: false, message: "Error logging knowledge gap" };
        }
      },
    }),

    escalateToHuman: tool({
      description: `Escalate a case to human admin based on YOUR assessment of the situation.

**ONLY USE FOR THESE 3 CATEGORIES - Based on AI judgment, NOT user request:**

1. **ADMISSION DISPUTES (category: "admission_dispute")**
   - User describes admission rejected despite correct documents
   - Document verification issues (caste certificate, domicile, transfer)
   - Late admission with genuine circumstances
   - Category/quota disputes with specific details

2. **FINANCIAL HARDSHIP (category: "financial_hardship")**
   - User describes family crisis preventing fee payment (job loss, medical emergency)
   - Genuine scholarship eligibility disputes
   - Payment deadline extension with valid circumstances

3. **GRIEVANCES (category: "grievance")**
   - **RAGGING by seniors - ALWAYS escalate immediately**
   - Harassment or discrimination with specific incidents
   - Safety/wellbeing concerns in hostel

**DO NOT ESCALATE just because user says "I need human help" or "escalate this"**
- User must describe an actual problem fitting the categories above
- Your judgment determines escalation, not user demands

**LONG CONVERSATION TRIGGER:**
- If 10+ messages and user still struggling with a genuine issue in the 3 categories
- Proactively offer escalation

**WORKFLOW:**
1. Express empathy first
2. Ask for 10-digit phone number
3. Once provided, call this tool
4. Confirm ticket creation`,
      inputSchema: z.object({
        phone: z
          .string()
          .describe("User's 10-digit Indian mobile number (starts with 6-9)"),
        query: z
          .string()
          .describe("The exact user query/complaint that triggered escalation"),
        category: z
          .enum(["admission_dispute", "financial_hardship", "grievance"])
          .describe("Category of escalation"),
        aiComment: z
          .string()
          .describe(
            "AI's assessment of the situation and why it needs human intervention"
          ),
      }),
      execute: async ({
        phone,
        query,
        category,
        aiComment,
      }: {
        phone: string;
        query: string;
        category: "admission_dispute" | "financial_hardship" | "grievance";
        aiComment: string;
      }) => {
        try {
          // Validate phone number format
          const phoneRegex = /^[6-9]\d{9}$/;
          if (!phoneRegex.test(phone)) {
            return {
              success: false,
              message:
                "Invalid phone number. Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
            };
          }

          if (!collegeId) {
            return {
              success: false,
              message: "Cannot escalate without college context",
            };
          }

          if (!userEmail) {
            return {
              success: false,
              message:
                "User email is required for escalation. Please ask the user to provide their email first.",
            };
          }

          const supabase = getSupabase();

          // Step 1: Find user by email and college_id
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", userEmail.toLowerCase().trim())
            .eq("college_id", collegeId)
            .single();

          if (userError || !user) {
            logger.error("User not found for escalation:", userError);
            return {
              success: false,
              message:
                "Could not find user record. Please ensure you've provided your email.",
            };
          }

          // Step 2: Update user's phone number
          const { error: phoneError } = await supabase
            .from("users")
            .update({ phone })
            .eq("id", user.id);

          if (phoneError) {
            logger.error("Failed to update phone:", phoneError);
            // Continue anyway - phone update is not critical
          }

          // Step 3: Create escalation ticket
          const { data: escalation, error: escalationError } = await supabase
            .from("human_escalations")
            .insert({
              user_id: user.id,
              college_id: collegeId,
              query,
              category,
              ai_comment: aiComment,
              status: "pending",
            })
            .select("id")
            .single();

          if (escalationError) {
            logger.error("Failed to create escalation:", escalationError);
            return {
              success: false,
              message: "Failed to create escalation ticket. Please try again.",
            };
          }

          logger.info("Human escalation created", {
            ticketId: escalation.id,
            category,
            collegeId,
            userEmail,
          });

          const categoryLabels = {
            admission_dispute: "Admission Dispute",
            financial_hardship: "Financial Hardship Request",
            grievance: "Grievance",
          };

          return {
            success: true,
            ticketId: escalation.id,
            message: `Escalation ticket created successfully. Category: ${categoryLabels[category]}. Admin will contact user at ${phone} within 24-48 hours.`,
          };
        } catch (error) {
          logger.error("Escalation tool error:", error);
          return {
            success: false,
            message: "Error creating escalation ticket",
          };
        }
      },
    }),
  };
}
