import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useOcrJobsList } from "@milestone/js-common/react/hooks/use-ocr-jobs-list";
import {
  OCR_JOB_STATUS_CLASS,
  OCR_JOB_STATUS_LABEL,
  OCR_REVIEW_STATUS_LABEL,
} from "@/lib/ocr-status-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

export default function OcrJobsScreen() {
  const { data: jobs, isLoading, isError } = useOcrJobsList();

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6 pb-24">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-foreground">Statement OCR jobs</Text>
          <Pressable onPress={() => router.push("/(app)/documents")}>
            <Text className="text-sm text-primary">Documents</Text>
          </Pressable>
        </View>

        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <View className="gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </View>
            ) : null}

            {isError ? (
              <Text className="text-sm text-destructive py-4">
                Failed to load OCR jobs. Please try again.
              </Text>
            ) : null}

            {!isLoading && !isError && jobs?.length === 0 ? (
              <View className="py-10 items-center gap-2">
                <Text className="text-sm text-muted-foreground">No OCR jobs yet.</Text>
                <Text className="text-xs text-muted-foreground text-center max-w-sm">
                  Upload a statement from the record or asset page to create one.
                </Text>
              </View>
            ) : null}

            {!isLoading && !isError && jobs && jobs.length > 0 ? (
              <View>
                {jobs.map((job) => (
                  <Pressable
                    key={job.id}
                    className="flex-row items-center justify-between py-3 border-b border-border active:bg-muted/40"
                    onPress={() => router.push(`/(app)/ocr-jobs/${job.id}`)}
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-medium text-foreground">
                        {job.documentFileName ?? "Document"}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {job.platformKey !== "unknown" ? job.platformKey : "Auto-detect"}
                        {" · "}
                        {new Date(job.startedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      {job.reviewState ? (
                        <Text className="text-xs text-muted-foreground">
                          {OCR_REVIEW_STATUS_LABEL[job.reviewState] ?? job.reviewState}
                        </Text>
                      ) : null}
                      <Text
                        className={cn(
                          "text-xs px-2 py-0.5 rounded overflow-hidden",
                          OCR_JOB_STATUS_CLASS[job.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
