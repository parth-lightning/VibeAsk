"use client";

import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Upload, Loader2 } from "lucide-react";
import {
  createSignedUploadUrl,
  processUploadedForm,
} from "@/app/actions/upload-form";

interface FormNoticeUploadProps {
  collegeId: string;
  onUploadComplete?: () => void;
}

export function FormNoticeUpload({
  collegeId,
  onUploadComplete,
}: FormNoticeUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [useOcr, setUseOcr] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      // Auto-fill title from filename if empty
      if (!title) {
        setTitle(files[0].name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    toast.info("Uploading file...");

    try {
      // 1. Get signed upload URL from server (bypasses RLS)
      const signedUrlResult = await createSignedUploadUrl(
        collegeId,
        selectedFile.name
      );

      if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
        throw new Error(signedUrlResult.error || "Failed to get upload URL");
      }

      const { signedUrl, filePath, publicUrl } = signedUrlResult;

      // 2. Upload file directly to Supabase Storage using signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      toast.info("Processing document...");

      // 3. Call server action with file path (no file data transferred)
      const result = await processUploadedForm({
        filePath: filePath!,
        publicUrl: publicUrl!,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        collegeId: collegeId,
        title: title || selectedFile.name,
        useOcr,
      });

      if (result.success) {
        toast.success(`Form/Notice uploaded successfully!`);
        // Reset form
        setSelectedFile(null);
        setTitle("");
        setUseOcr(false);
        onUploadComplete?.();
      } else {
        toast.error(result.error || "Processing failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload form/notice"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 overflow-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Form or Notice
          </CardTitle>
          <CardDescription>
            Upload forms, notices, circulars, or application documents. These
            will be summarized for search but provided in full to the AI when
            relevant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Area */}
          <div className="border border-dashed border-neutral-200 rounded-lg overflow-hidden bg-white min-h-[150px]">
            <FileUpload onChange={handleFileSelect} />
          </div>

          {/* Selected File Preview */}
          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                Remove
              </Button>
            </div>
          )}

          {/* Title Input */}
          <div className="grid gap-2">
            <Label htmlFor="title">Document Title (Optional)</Label>
            <Input
              id="title"
              placeholder="e.g., Vidya Sambal Yojana Application Form"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the filename
            </p>
          </div>

          {/* OCR Toggle */}
          <div className="items-top flex gap-2">
            <Checkbox
              id="useOcr"
              checked={useOcr}
              onCheckedChange={(checked) => setUseOcr(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="useOcr"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Hindi/scanned documents
              </label>
              <p className="text-muted-foreground text-xs">
                Enable this for scanned PDFs or documents with Hindi text for
                better text extraction.
              </p>
            </div>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
