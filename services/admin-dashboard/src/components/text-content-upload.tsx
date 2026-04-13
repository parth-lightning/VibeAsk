"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Type, Plus, Loader2, Trash2, FileText } from "lucide-react";
import {
  addTextContent,
  getTextContent,
  deleteTextContent,
  TextContentItem,
} from "@/app/actions/text-content";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { Textarea } from "./ui/textarea";

interface TextContentUploadProps {
  collegeId: string;
  onContentChange?: () => void;
}

export function TextContentUpload({
  collegeId,
  onContentChange,
}: TextContentUploadProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textItems, setTextItems] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTextContent = useCallback(async () => {
    setIsLoading(true);
    const result = await getTextContent(collegeId);
    if (result.success) {
      setTextItems(result.data || []);
    }
    setIsLoading(false);
  }, [collegeId]);

  useEffect(() => {
    loadTextContent();
  }, [loadTextContent]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!content.trim() || content.trim().length < 20) {
      toast.error("Content must be at least 20 characters");
      return;
    }

    setIsSubmitting(true);
    toast.info("Adding content to knowledge base...");

    try {
      const result = await addTextContent(collegeId, title, content);

      if (result.success) {
        toast.success("Content added successfully!");
        setTitle("");
        setContent("");
        loadTextContent();
        onContentChange?.();
      } else {
        toast.error(result.error || "Failed to add content");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to add content");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    toast.promise(deleteTextContent(id), {
      loading: `Deleting "${itemTitle}"...`,
      success: () => {
        setTextItems(textItems.filter((item) => item.id !== id));
        onContentChange?.();
        return "Content deleted successfully";
      },
      error: "Failed to delete content",
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Left Side: Add Content Form */}
      <div className="flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Add Text Content
            </CardTitle>
            <CardDescription>
              Paste or type text content directly. This will be embedded and
              used as context for AI responses. Great for: announcements, quick
              facts, custom information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title Input */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., College Contact Information"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Content Textarea */}
            <div className="grid gap-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Paste or type your content here...

Example:
Principal: Dr. Rajesh Kumar
Phone: 0298-2220634
Email: gpc.barmer@rajasthan.gov.in
Address: Government Polytechnic College, Barmer, Rajasthan - 344001

Office Hours: Monday to Saturday, 9:00 AM to 5:00 PM"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setContent(e.target.value)
                }
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {content.length} characters
                {content.length > 0 && content.length < 20 && (
                  <span className="text-destructive">
                    {" "}
                    (minimum 20 required)
                  </span>
                )}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || content.length < 20}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add to Knowledge Base
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Side: Text Content List */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Text Content</h2>
          <p className="text-sm text-muted-foreground">
            Custom text entries in the knowledge base.
          </p>
        </div>

        <div className="flex-1 overflow-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : textItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              No text content added yet.
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {textItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-full shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {item.content.slice(0, 150)}
                            {item.content.length > 150 ? "..." : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.content.length} chars
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(item.id, item.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
