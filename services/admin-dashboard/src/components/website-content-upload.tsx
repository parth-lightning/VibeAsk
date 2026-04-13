"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Globe, Loader2, Trash2, ExternalLink, Sparkles } from "lucide-react";
import {
  getWebsiteContent,
  deleteWebsiteContent,
  WebsiteContentItem,
} from "@/app/actions/website-content";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";

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

interface WebsiteContentUploadProps {
  collegeId: string;
  onContentChange?: () => void;
}

export function WebsiteContentUpload({
  collegeId,
  onContentChange,
}: WebsiteContentUploadProps) {
  const [websiteItems, setWebsiteItems] = useState<WebsiteContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoScraping, setIsAutoScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<ProgressEvent[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  const loadWebsiteContent = useCallback(async () => {
    setIsLoading(true);
    const result = await getWebsiteContent(collegeId);
    if (result.success) {
      setWebsiteItems(result.data || []);
    }
    setIsLoading(false);
  }, [collegeId]);

  useEffect(() => {
    loadWebsiteContent();
  }, [loadWebsiteContent]);

  const handleDelete = async (id: string, itemTitle: string) => {
    toast.promise(deleteWebsiteContent(id), {
      loading: `Deleting "${itemTitle}"...`,
      success: () => {
        setWebsiteItems(websiteItems.filter((item) => item.id !== id));
        onContentChange?.();
        return "Content deleted successfully";
      },
      error: "Failed to delete content",
    });
  };

  const handleAutoScrape = async () => {
    setIsAutoScraping(true);
    setScrapeProgress([]);
    setShowProgress(true);

    try {
      const response = await fetch("/api/scrape-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as ProgressEvent;
              setScrapeProgress((prev) => [...prev, event]);

              // Show key notifications
              if (event.type === "complete") {
                toast.success(
                  `✅ Scraped ${event.summary.totalPages} pages in ${event.summary.timeTaken}s!`
                );
                loadWebsiteContent();
                onContentChange?.();
              } else if (event.type === "error" && !event.url) {
                toast.error(`Error: ${event.error}`);
              }
            } catch (e) {
              console.error("Failed to parse SSE event:", e);
            }
          }
        }
      }
    } catch (error) {
      toast.error("Scraping failed");
      console.error(error);
    } finally {
      setIsAutoScraping(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Auto-Scrape Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Website Content Auto-Scraper
              </CardTitle>
              <CardDescription>
                Automatically scrape your college website to extract all pages
                and add them to the knowledge base. The AI agent will discover
                and scrape up to 25 relevant pages including departments,
                admissions, placements, and more.
              </CardDescription>
            </div>
            <Button
              onClick={handleAutoScrape}
              disabled={isAutoScraping}
              variant="default"
              size="lg"
              className="shrink-0"
            >
              {isAutoScraping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Auto-Scrape Website
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {showProgress && scrapeProgress.length > 0 && (
          <CardContent>
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Scraping Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {scrapeProgress.slice(-10).map((event, idx) => (
                    <div key={idx} className="text-xs font-mono">
                      {event.type === "status" && (
                        <div className="text-blue-600">
                          [{event.step}/{event.totalSteps}] {event.message}
                        </div>
                      )}
                      {event.type === "url-found" && (
                        <div className="text-green-600">
                          ✓ Found: {event.url}
                        </div>
                      )}
                      {event.type === "scraping" && (
                        <div className="text-orange-600">
                          [{event.index}/{event.total}] Scraping...
                        </div>
                      )}
                      {event.type === "saved" && (
                        <div className="text-green-600">
                          ✓ Saved "{event.title}" ({event.chunks} chunks)
                        </div>
                      )}
                      {event.type === "error" && (
                        <div className="text-red-600">
                          ✗ Error: {event.error}
                        </div>
                      )}
                      {event.type === "complete" && (
                        <div className="text-green-600 font-bold">
                          ✅ Complete! {event.summary.totalPages} pages,{" "}
                          {event.summary.totalChunks} chunks in{" "}
                          {event.summary.timeTaken}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!isAutoScraping && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setShowProgress(false)}
                  >
                    Close
                  </Button>
                )}
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      {/* Scraped Pages List */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>Scraped Website Pages</CardTitle>
          <CardDescription>
            Pages automatically scraped from your college website with citation
            URLs
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto pr-2">
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : websiteItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No website content yet</p>
                  <p className="text-sm mt-2">
                    Click "Auto-Scrape Website" above to automatically discover
                    and scrape your college website
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {websiteItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-blue-100 rounded-full shrink-0">
                            <Globe className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.title}</p>
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
                            >
                              {item.source_url}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.content.length} chars •{" "}
                              {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="secondary"
                            className="text-blue-600 bg-blue-100 hover:bg-blue-100"
                          >
                            Website
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            onClick={() => handleDelete(item.id, item.title)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
