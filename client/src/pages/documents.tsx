import { FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/use-documents";
import type { DocumentWithOcr } from "@shared/schema/document";

const OCR_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Processing",
  completed: "Completed",
  failed: "Failed",
  aborted: "Aborted",
};

const OCR_STATUS_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  aborted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function DocumentRow({ doc }: { doc: DocumentWithOcr }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(doc.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {" · "}
            {doc.mimeType}
          </p>
        </div>
      </div>

      {doc.ocrJob && (
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {doc.ocrJob.platformKey !== "unknown" ? doc.ocrJob.platformKey : "Auto-detect"}
          </span>
          <span
            className={[
              "text-xs px-2 py-0.5 rounded",
              OCR_STATUS_CLASS[doc.ocrJob.status] ?? "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {OCR_STATUS_LABEL[doc.ocrJob.status] ?? doc.ocrJob.status}
          </span>
        </div>
      )}
    </div>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const { documents, isLoading, isError } = useDocuments();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Uploaded statements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <DocumentsSkeleton />}

          {isError && (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load documents. Please try again.
            </div>
          )}

          {!isLoading && !isError && documents?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No documents uploaded yet.</p>
            </div>
          )}

          {!isLoading && !isError && documents && documents.length > 0 && (
            <div>
              {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
