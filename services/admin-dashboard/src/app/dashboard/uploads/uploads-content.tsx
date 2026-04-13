"use client";

import { useState, useEffect, useCallback } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  FileText,
  CheckCircle,
  BookOpen,
  FileCheck,
  Type,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormNoticeUpload } from "@/components/form-notice-upload";
import { TextContentUpload } from "@/components/text-content-upload";
import { WebsiteContentUpload } from "@/components/website-content-upload";

import { uploadDocument } from "@/app/actions/upload-document";
import { getFiles } from "@/app/actions/get-files";
import { deleteDocument } from "@/app/actions/delete-document";

interface FileItem {
  id: string;
  name: string;
  url: string;
  size: string;
  uploadDate: string;
  document_type: string;
}

interface UploadsContentProps {
  collegeId: string;
}

export function UploadsContent({ collegeId }: UploadsContentProps) {
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);

  const loadFiles = useCallback(async () => {
    const result = await getFiles(collegeId);
    if (result.success) {
      setUploadedFiles(result.data || []);
    }
  }, [collegeId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (files: File[]) => {
    toast.info("Starting upload...");

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("collegeId", collegeId);

      try {
        const result = await uploadDocument(formData);
        if (result.success) {
          toast.success(`Uploaded ${file.name}`);
          loadFiles();
        } else {
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch {
        toast.error(`Error uploading ${file.name}`);
      }
    }
  };

  const handleDelete = async (id: string, url: string) => {
    toast.promise(deleteDocument(id, url), {
      loading: "Deleting...",
      success: () => {
        setUploadedFiles(uploadedFiles.filter((file) => file.id !== id));
        return "File deleted successfully";
      },
      error: "Failed to delete file",
    });
  };

  // Filter files by document type
  // info = general information documents (FAQs, policies)
  // form = forms and notices
  // website/text = handled by their own components with separate data fetching
  const infoFiles = uploadedFiles.filter(
    (f) => f.document_type === "info" || !f.document_type
  );
  const formFiles = uploadedFiles.filter(
    (f) => f.document_type === "structured"
  );

  // Reusable file list component
  const FileList = ({
    files,
    emptyMessage,
  }: {
    files: FileItem[];
    emptyMessage: string;
  }) => (
    <div className="flex-1 overflow-auto pr-2">
      <div className="space-y-4">
        {files.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            {emptyMessage}
          </div>
        ) : (
          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-full">
                    {file.document_type === "structured" ? (
                      <FileCheck className="h-5 w-5 text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{file.size}</span>
                      <span>•</span>
                      <span>{file.uploadDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-green-600 bg-green-100 hover:bg-green-100 gap-1"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Processed
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                    onClick={() => handleDelete(file.id, file.url)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Tabs defaultValue="info" className="flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="info" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Information Documents
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Forms & Notices
          </TabsTrigger>
          <TabsTrigger value="website" className="gap-2">
            <Globe className="h-4 w-4" />
            Website Content
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <Type className="h-4 w-4" />
            Text Content
          </TabsTrigger>
        </TabsList>

        {/* Information Documents Tab */}
        <TabsContent value="info" className="flex-1 mt-4">
          <div className="flex flex-col md:flex-row h-full gap-6 min-h-[550px]">
            {/* Left Side: Upload Area */}
            <div className="flex-1 flex flex-col border rounded-lg p-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  Upload Information Documents
                </h2>
                <p className="text-sm text-muted-foreground">
                  Upload general information documents. These will be chunked
                  and embedded for semantic search. Best for: FAQs, policies,
                  guidelines.
                </p>
              </div>
              <div className="flex-1 w-full border border-dashed bg-white border-neutral-200 rounded-lg overflow-hidden">
                <FileUpload onChange={handleFileUpload} />
              </div>
            </div>

            <Separator
              orientation="vertical"
              className="hidden md:block h-full bg-neutral-200"
            />

            {/* Right Side: Uploaded Files List */}
            <div className="flex-1 flex flex-col h-full">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Information Documents</h2>
                <p className="text-sm text-muted-foreground">
                  Documents chunked for semantic search.
                </p>
              </div>
              <FileList
                files={infoFiles}
                emptyMessage="No information documents uploaded yet."
              />
            </div>
          </div>
        </TabsContent>

        {/* Forms & Notices Tab */}
        <TabsContent value="forms" className="flex-1 mt-4 overflow-auto">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Side: Form Upload */}
            <div className="flex-1 flex flex-col">
              <FormNoticeUpload
                collegeId={collegeId}
                onUploadComplete={loadFiles}
              />
            </div>

            <Separator
              orientation="vertical"
              className="hidden md:block h-full bg-neutral-200"
            />

            {/* Right Side: Forms/Notices List */}
            <div className="flex-1 flex flex-col h-full">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Forms & Notices</h2>
                <p className="text-sm text-muted-foreground">
                  Documents with AI-generated summaries. Full document provided
                  to AI when relevant.
                </p>
              </div>
              <FileList
                files={formFiles}
                emptyMessage="No forms or notices uploaded yet."
              />
            </div>
          </div>
        </TabsContent>

        {/* Text Content Tab */}
        <TabsContent value="text" className="flex-1 mt-4 overflow-auto">
          <TextContentUpload
            collegeId={collegeId}
            onContentChange={loadFiles}
          />
        </TabsContent>

        {/* Website Content Tab */}
        <TabsContent value="website" className="flex-1 mt-4 overflow-auto">
          <WebsiteContentUpload
            collegeId={collegeId}
            onContentChange={loadFiles}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
