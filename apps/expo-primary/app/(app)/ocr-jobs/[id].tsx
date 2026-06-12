import { ScrollView, Text, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useOcrJobDetail } from "@milestone/js-common/react/hooks/use-ocr-job-detail";
import {
  OCR_JOB_STATUS_CLASS,
  OCR_JOB_STATUS_LABEL,
  OCR_REVIEW_STATUS_LABEL,
} from "@/lib/ocr-status-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function formatDate(date: Date | string | null | undefined): string {
  if (date == null) return "—";
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row justify-between gap-4 py-2 border-b border-border">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="flex-1 items-end">{children}</View>
    </View>
  );
}

export default function OcrJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, isLoading, isError, error } = useOcrJobDetail(id);
  const extracted = job?.extractedValues ?? [];

  if (!id) {
    return (
      <ScrollView className="flex-1 bg-background p-4">
        <Text className="text-sm text-muted-foreground">Missing job id.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6 pb-24">
        <View className="flex-row items-center gap-2 mb-6">
          <Pressable onPress={() => router.back()}>
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground">OCR job</Text>
        </View>

        {isLoading ? (
          <View className="gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </View>
        ) : null}

        {isError ? (
          <Text className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load this OCR job."}
          </Text>
        ) : null}

        {!isLoading && !isError && job ? (
          <View className="gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Document</CardTitle>
              </CardHeader>
              <CardContent>
                <MetaRow label="File">
                  <Text className="text-sm font-medium text-foreground text-right">
                    {job.documentFileName ?? "—"}
                  </Text>
                </MetaRow>
                <MetaRow label="Platform">
                  <Text className="text-sm text-foreground">
                    {job.platformKey !== "unknown" ? job.platformKey : "Auto-detect"}
                  </Text>
                </MetaRow>
                <MetaRow label="Status">
                  <Text
                    className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      OCR_JOB_STATUS_CLASS[job.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
                  </Text>
                </MetaRow>
                {job.reviewState ? (
                  <MetaRow label="Review">
                    <Text className="text-sm text-foreground">
                      {OCR_REVIEW_STATUS_LABEL[job.reviewState] ?? job.reviewState}
                    </Text>
                  </MetaRow>
                ) : null}
                <MetaRow label="Started">
                  <Text className="text-sm text-foreground">{formatDate(job.startedAt)}</Text>
                </MetaRow>
                <MetaRow label="Completed">
                  <Text className="text-sm text-foreground">{formatDate(job.completedAt)}</Text>
                </MetaRow>
                {job.error ? (
                  <View className="pt-3">
                    <Text className="text-xs text-muted-foreground mb-1">Error</Text>
                    <Text className="text-xs text-destructive">{job.error}</Text>
                  </View>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extracted balances</CardTitle>
              </CardHeader>
              <CardContent>
                {extracted.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">None recorded.</Text>
                ) : (
                  extracted.map((value, index) => (
                    <View key={index} className="py-2 border-b border-border">
                      <Text className="text-sm text-foreground">
                        {JSON.stringify(value, null, 2)}
                      </Text>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
