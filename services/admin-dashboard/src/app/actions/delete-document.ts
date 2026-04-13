"use server";

import { supabaseAdmin } from "@/lib/supabase";

export async function deleteDocument(fileId: string, storagePath: string) {
  try {
    // 1. Delete from Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("documents")
      .remove([storagePath]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue to delete DB record even if storage fails (to keep DB clean)
    }

    // 2. Delete chunks from documents table
    const { error: docsError } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("file_id", fileId);

    if (docsError) {
      console.warn("Documents delete warning:", docsError.message);
    }

    // 3. Delete parent documents
    const { error: parentError } = await supabaseAdmin
      .from("parent_documents")
      .delete()
      .eq("file_id", fileId);

    if (parentError) {
      console.warn("Parent documents delete warning:", parentError.message);
    }

    // 4. Delete from Database (Files table)
    const { error: dbError } = await supabaseAdmin
      .from("files")
      .delete()
      .eq("id", fileId);

    if (dbError) {
      throw new Error(`Database delete failed: ${dbError.message}`);
    }

    return { success: true, message: "Document deleted successfully" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Delete error:", error);
    return { success: false, error: error.message };
  }
}
