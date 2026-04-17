import { Link } from "wouter";
import { FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/use-documents";
import type { DocumentWithOcr } from "@shared/schema/document";
import { OCR_JOB_STATUS_CLASS, OCR_JOB_STATUS_LABEL } from "@/lib/ocr-status-display";

function formatJobStarted(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocumentRow({ doc }: { doc: DocumentWithOcr }) {
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
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

          <div className="text-xs">
            <span className="text-muted-foreground">OCR jobs: </span>
            {doc.ocrJobs.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
                {doc.ocrJobs.map((job, index) => (
                  <span key={job.id} className="inline-flex items-center gap-1">
                    {index > 0 ? <span className="text-muted-foreground">·</span> : null}
                    <Link
                      href={`/ocr-jobs/${job.id}`}
                      className="text-primary font-medium underline-offset-2 hover:underline"
                    >
                      {formatJobStarted(job.startedAt)}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        (
                        {job.platformKey !== "unknown" ? job.platformKey : "auto"}
                        {", "}
                        <span
                          className={[
                            "inline rounded px-1.5 py-0.5",
                            OCR_JOB_STATUS_CLASS[job.status] ??
                              "bg-muted text-muted-foreground",
                          ].join(" ")}
                        >
                          {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
                        </span>
                        )
                      </span>
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-3">
          <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const { documents, isLoading, isError } = useDocuments();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Link href="/ocr-jobs" className="text-sm text-muted-foreground hover:text-foreground">
          OCR jobs
        </Link>
      </div>

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
