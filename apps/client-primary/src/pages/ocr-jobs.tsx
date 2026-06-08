import { Link } from "wouter";
import { AlertCircle, ChevronRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOcrJobsList } from "@/hooks/use-ocr-jobs-list";
import {
  OCR_JOB_STATUS_CLASS,
  OCR_JOB_STATUS_LABEL,
  OCR_REVIEW_STATUS_LABEL,
} from "@/lib/ocr-status-display";

export default function OcrJobsPage() {
  const { data: jobs, isLoading, isError } = useOcrJobsList();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Statement OCR jobs</h1>
        <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground">
          Documents
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load OCR jobs. Please try again.
            </div>
          )}

          {!isLoading && !isError && jobs?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No OCR jobs yet.</p>
              <p className="text-xs text-center max-w-sm">
                Upload a statement from the record or asset page to create one.
              </p>
            </div>
          )}

          {!isLoading && !isError && jobs && jobs.length > 0 && (
            <ul className="divide-y">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/ocr-jobs/${job.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {job.documentFileName ?? "Document"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.platformKey !== "unknown" ? job.platformKey : "Auto-detect"}
                        {" · "}
                        {new Date(job.startedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.reviewState && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {OCR_REVIEW_STATUS_LABEL[job.reviewState] ?? job.reviewState}
                        </span>
                      )}
                      <span
                        className={[
                          "text-xs px-2 py-0.5 rounded",
                          OCR_JOB_STATUS_CLASS[job.status] ?? "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
