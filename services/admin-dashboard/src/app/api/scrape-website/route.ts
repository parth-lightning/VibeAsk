import { NextRequest } from "next/server";
import { colleges } from "@/lib/colleges";
import Firecrawl from "@mendable/firecrawl-js";
import { openai } from "@ai-sdk/openai";
import { Experimental_Agent as Agent, tool, stepCountIs } from "ai";
import { z } from "zod";
import { addWebsiteContent } from "@/app/actions/website-content";

// Maximum duration for Vercel Hobby plan (5 minutes)
export const maxDuration = 300;

// SSE Progress Event Types
type ProgressEvent =
  | { type: "status"; message: string; step: number; totalSteps: number }
  | { type: "url-found"; url: string; category: string }
  | { type: "scraping"; url: string; index: number; total: number }
  | { type: "saved"; url: string; chunks: number; title: string }
  | { type: "error"; error: string; url?: string }
  | {
      type: "complete";
      summary: { totalPages: number; totalChunks: number; timeTaken: number };
    };

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { collegeId } = await req.json();

    if (!collegeId) {
      return new Response(JSON.stringify({ error: "College ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Helper to send SSE events
    const sendEvent = (
      controller: ReadableStreamDefaultController,
      event: ProgressEvent
    ) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(encoder.encode(data));
    };

    // Get college info
    const college = colleges.find((c) => c.slug === collegeId);
    if (!college?.homepageUrl) {
      return new Response(
        JSON.stringify({ error: "College not found or no homepage URL" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

    // Create autonomous scraping agent
    const scrapingAgent = new Agent({
      model: openai("gpt-4o-mini"),
      tools: {
        scrapeHomepage: tool({
          description:
            "Scrape the college homepage to get full content including navigation links",
          inputSchema: z.object({
            url: z.string().url().describe("Homepage URL to scrape"),
          }),
          execute: async ({ url }) => {
            const result = await firecrawl.scrape(url, {
              formats: ["markdown", "html"],
              onlyMainContent: false, // Include nav/header/footer with links
              waitFor: 2000, // Wait for dynamic content to load
            });
            return {
              success: true,
              markdown: result.markdown || "",
              contentLength: result.markdown?.length || 0,
            };
          },
        }),
        extractUrls: tool({
          description:
            "Extract important URLs from homepage markdown - focuses on departments, admissions, placements, student resources",
          inputSchema: z.object({
            homepageUrl: z.string().url(),
            content: z.string(),
          }),
          execute: async ({ homepageUrl, content }) => {
            // Extract markdown links: [text](url) format
            const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
            const foundLinks: string[] = [];
            let match;

            while ((match = markdownLinkRegex.exec(content)) !== null) {
              foundLinks.push(match[2]); // URL is in capture group 2
            }

            // Also extract plain URLs
            const plainUrlRegex =
              /(?<!\()(https?:\/\/[^\s<>"{}|\\^`\[\])\n]+)/g;
            const plainUrls = content.match(plainUrlRegex) || [];
            foundLinks.push(...plainUrls);

            // Filter relevant URLs (webpages only - no PDFs, images, etc.)
            const hostname = new URL(homepageUrl).hostname;
            const imageExtensions = [
              ".jpg",
              ".jpeg",
              ".png",
              ".gif",
              ".webp",
              ".svg",
              ".bmp",
              ".ico",
            ];
            const documentExtensions = [
              ".pdf",
              ".doc",
              ".docx",
              ".xls",
              ".xlsx",
              ".ppt",
              ".pptx",
              ".zip",
              ".rar",
            ];
            const excludedExtensions = [
              ...imageExtensions,
              ...documentExtensions,
            ];

            const relevantUrls = Array.from(new Set(foundLinks)).filter(
              (url) => {
                try {
                  const urlObj = new URL(url);
                  const pathname = urlObj.pathname.toLowerCase();

                  // Exclude files with image/document extensions
                  if (
                    excludedExtensions.some((ext) => pathname.endsWith(ext))
                  ) {
                    return false;
                  }

                  // Keep URLs from same domain or subdomains
                  return (
                    urlObj.hostname.includes(hostname) ||
                    hostname.includes(urlObj.hostname)
                  );
                } catch {
                  return false;
                }
              }
            );

            // Prioritize important pages (case-insensitive keywords)
            const keywords = [
              "department",
              "admission",
              "placement",
              "fee",
              "scholarship",
              "syllabus",
              "download",
              "student",
              "notice",
              "achievement",
              "civil",
              "mechanical",
              "computer",
              "electrical",
              "electronics",
            ];

            const priorityUrls = relevantUrls.filter((url) =>
              keywords.some((keyword) => url.toLowerCase().includes(keyword))
            );

            // Combine: prioritized first, then others, limit to 25 URLs
            const finalUrls = [
              ...priorityUrls,
              ...relevantUrls.filter((url) => !priorityUrls.includes(url)),
            ].slice(0, 25);

            return {
              urls: finalUrls,
              count: finalUrls.length,
            };
          },
        }),
        batchScrapeAndSave: tool({
          description:
            "Scrape multiple URLs and save all content to knowledge base",
          inputSchema: z.object({
            urls: z.array(z.string().url()),
            collegeId: z.string(),
          }),
          execute: async ({ urls, collegeId: cid }) => {
            if (urls.length === 0) {
              return { totalPages: 0, totalChunks: 0, savedPages: [] };
            }

            try {
              const batchJob = await firecrawl.batchScrape(urls);

              const scrapeResults = batchJob.data || [];

              if (!scrapeResults || scrapeResults.length === 0) {
                throw new Error(
                  `Batch scrape returned no data. Job status: ${JSON.stringify(
                    batchJob
                  )}`
                );
              }
              let totalChunks = 0;
              let successCount = 0;
              const savedPages: Array<{
                url: string;
                title: string;
                chunks: number;
              }> = [];

              for (let i = 0; i < scrapeResults.length; i++) {
                const result = scrapeResults[i];
                const pageUrl = urls[i] || "";
                const markdown = result.markdown || "";

                if (markdown.length < 50) continue;

                // Extract title
                const titleMatch = markdown.match(/^#\s+(.+)$/m);
                const urlPath = new URL(pageUrl).pathname
                  .split("/")
                  .filter(Boolean)
                  .pop();
                const title = titleMatch?.[1] || urlPath || `Page ${i + 1}`;

                const saveResult = await addWebsiteContent(
                  cid,
                  title,
                  markdown,
                  pageUrl
                );

                if (saveResult.success) {
                  totalChunks += saveResult.chunkCount || 0;
                  successCount++;
                  savedPages.push({
                    url: pageUrl,
                    title,
                    chunks: saveResult.chunkCount || 0,
                  });
                }
              }

              return {
                totalPages: successCount,
                totalChunks,
                savedPages,
                skipped: scrapeResults.length - successCount,
              };
            } catch (error) {
              console.error("Batch scrape error:", error);
              throw new Error(
                `Batch scrape failed: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          },
        }),
      },
      stopWhen: stepCountIs(20), // Max 10 agent steps
    });

    // Stream agent execution with SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await scrapingAgent.stream({
            prompt: `You are a web scraping agent. Scrape the college website and save all important pages.

College: ${college.name}
Homepage URL: ${college.homepageUrl}
College ID: ${collegeId}

Your workflow:
1. Use scrapeHomepage to get the homepage content
2. Use extractUrls to find important pages from the homepage
3. Use batchScrapeAndSave to scrape all URLs and save to database

Work through each step systematically.`,
          });

          let stepCount = 0;
          let totalPages = 0;
          let totalChunks = 0;

          for await (const chunk of result.fullStream) {
            switch (chunk.type) {
              case "tool-call":
                stepCount++;
                sendEvent(controller, {
                  type: "status",
                  message: `Calling tool: ${chunk.toolName}`,
                  step: stepCount,
                  totalSteps: 10,
                });
                break;

              case "tool-result":
                // Handle extractUrls results
                if (chunk.toolName === "extractUrls" && "output" in chunk) {
                  const toolOutput = chunk.output as {
                    urls?: string[];
                    count?: number;
                  };
                  toolOutput.urls?.forEach((url) => {
                    sendEvent(controller, {
                      type: "url-found",
                      url,
                      category: "general",
                    });
                  });
                  sendEvent(controller, {
                    type: "status",
                    message: `Found ${toolOutput.count || 0} URLs`,
                    step: stepCount,
                    totalSteps: 10,
                  });
                }

                // Handle batchScrapeAndSave results
                if (
                  chunk.toolName === "batchScrapeAndSave" &&
                  "output" in chunk
                ) {
                  const toolOutput = chunk.output as {
                    totalPages?: number;
                    totalChunks?: number;
                    savedPages?: Array<{
                      url: string;
                      title: string;
                      chunks: number;
                    }>;
                  };
                  totalPages = toolOutput.totalPages || 0;
                  totalChunks = toolOutput.totalChunks || 0;

                  toolOutput.savedPages?.forEach((page) => {
                    sendEvent(controller, {
                      type: "saved",
                      url: page.url,
                      chunks: page.chunks,
                      title: page.title,
                    });
                  });
                }
                break;

              case "text-delta":
                // Agent thinking/reasoning (optional to display)
                break;

              case "finish":
                const timeTaken = Math.round((Date.now() - startTime) / 1000);
                sendEvent(controller, {
                  type: "complete",
                  summary: {
                    totalPages,
                    totalChunks,
                    timeTaken,
                  },
                });
                break;

              case "error":
                sendEvent(controller, {
                  type: "error",
                  error:
                    "error" in chunk && chunk.error instanceof Error
                      ? chunk.error.message
                      : "Unknown error",
                });
                break;
            }
          }
        } catch (error) {
          sendEvent(controller, {
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Scrape workflow error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
