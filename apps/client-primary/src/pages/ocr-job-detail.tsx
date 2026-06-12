import { Link, useParams } from "wouter";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOcrJobDetail } from "@/hooks/use-ocr-job-detail";
import {
  OCR_JOB_STATUS_CLASS,
  OCR_JOB_STATUS_LABEL,
  OCR_REVIEW_STATUS_LABEL,
} from "@/lib/ocr-status-display";
import {
  OcrPipelineReadonlyPanels,
  OcrResultsCodeBlock,
  OcrResultsExtractedBalancesReadonly,
  OcrResultsMetaRow,
  OcrResultsSection,
} from "@/components/ocr/results-layout";

function formatDate(d: Date | string | null | undefined): string {
  if (d == null) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OcrJobDetailPage() {
  const params = useParams<{ id: string }>();
  const ocrJobId = params?.id;

  const { data: job, isLoading, isError, error } = useOcrJobDetail(ocrJobId);

  if (!ocrJobId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">Missing job id.</p>
      </div>
    );
  }

  const extracted = job?.extractedValues ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/ocr-jobs">
          <Button variant="ghost" size="icon" aria-label="Back to OCR jobs">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">OCR job</h1>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error instanceof Error ? error.message : "Failed to load this OCR job."}
        </div>
      )}

      {!isLoading && !isError && job && (
        <div className="space-y-4">
          <OcrResultsSection title="Document">
            <OcrResultsMetaRow label="File">
              <span className="font-medium">
                {job.documentFileName ?? "—"}
                {job.documentId ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    (
                    <Link
                      href="/documents"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      documents list
                    </Link>
                    )
                  </span>
                ) : null}
              </span>
            </OcrResultsMetaRow>
            <OcrResultsMetaRow label="Platform">
              <span>{job.platformKey !== "unknown" ? job.platformKey : "Auto-detect"}</span>
            </OcrResultsMetaRow>
            <OcrResultsMetaRow label="OCR job status" align="center">
              <span
                className={[
                  "text-xs px-2 py-0.5 rounded",
                  OCR_JOB_STATUS_CLASS[job.status] ?? "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
              </span>
            </OcrResultsMetaRow>
            {job.reviewState ? (
              <OcrResultsMetaRow label="Review">
                <span>{OCR_REVIEW_STATUS_LABEL[job.reviewState] ?? job.reviewState}</span>
              </OcrResultsMetaRow>
            ) : null}
            <OcrResultsMetaRow label="Started">
              <span>{formatDate(job.startedAt)}</span>
            </OcrResultsMetaRow>
            <OcrResultsMetaRow label="Completed">
              <span>{formatDate(job.completedAt)}</span>
            </OcrResultsMetaRow>
            {job.error ? (
              <div className="pt-2 space-y-1">
                <span className="text-muted-foreground text-xs">Error</span>
                <OcrResultsCodeBlock>{job.error}</OcrResultsCodeBlock>
              </div>
            ) : null}
          </OcrResultsSection>

          <OcrResultsSection title="Background process">
            {job.process ? (
              <>
                <OcrResultsMetaRow label="Process id">
                  <span className="font-mono text-xs break-all">{job.process.id}</span>
                </OcrResultsMetaRow>
                <OcrResultsMetaRow label="Key">
                  <span className="font-mono text-xs">{job.process.key}</span>
                </OcrResultsMetaRow>
                <OcrResultsMetaRow label="Status" align="center">
                  <span
                    className={[
                      "text-xs px-2 py-0.5 rounded",
                      OCR_JOB_STATUS_CLASS[job.process.status] ??
                        "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {OCR_JOB_STATUS_LABEL[job.process.status] ?? job.process.status}
                  </span>
                </OcrResultsMetaRow>
                <OcrResultsMetaRow label="Started">
                  <span>{formatDate(job.process.startedAt)}</span>
                </OcrResultsMetaRow>
                <OcrResultsMetaRow label="Completed">
                  <span>{formatDate(job.process.completedAt)}</span>
                </OcrResultsMetaRow>
                {job.process.error ? (
                  <div className="pt-2 space-y-1">
                    <span className="text-muted-foreground text-xs">Process error</span>
                    <OcrResultsCodeBlock>{job.process.error}</OcrResultsCodeBlock>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No linked process row.</p>
            )}
          </OcrResultsSection>

          {job.pipeline ? (
            <OcrPipelineReadonlyPanels pipeline={job.pipeline} extractedValues={extracted} />
          ) : (
            <>
              <OcrResultsSection title="Pipeline output">
                <p className="text-sm text-muted-foreground">
                  No pipeline data (job not completed or unavailable).
                </p>
              </OcrResultsSection>
              <OcrResultsSection title="Extracted balances">
                {extracted.length > 0 ? (
                  <>
                    <OcrResultsExtractedBalancesReadonly values={extracted} />
                    <div className="pt-4 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Raw JSON</p>
                      <OcrResultsCodeBlock className="max-h-[240px] overflow-y-auto">
                        {JSON.stringify(extracted, null, 2)}
                      </OcrResultsCodeBlock>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded.</p>
                )}
              </OcrResultsSection>
            </>
          )}
        </div>
      )}
    </div>
  );
}
