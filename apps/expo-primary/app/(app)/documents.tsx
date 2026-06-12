import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useDocuments } from "@milestone/js-common/react/hooks/use-documents";
import type { DocumentWithOcr } from "@milestone/js-common/schema/document";
import {
  OCR_JOB_STATUS_CLASS,
  OCR_JOB_STATUS_LABEL,
} from "@/lib/ocr-status-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function formatJobStarted(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocumentRow({ doc }: { doc: DocumentWithOcr }) {
  return (
    <View className="py-3 border-b border-border">
      <Text className="text-sm font-medium text-foreground">{doc.fileName}</Text>
      <Text className="text-xs text-muted-foreground mt-1">
        {new Date(doc.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
        {" · "}
        {doc.mimeType}
      </Text>
      <View className="mt-2">
        <Text className="text-xs text-muted-foreground">OCR jobs: </Text>
        {doc.ocrJobs.length === 0 ? (
          <Text className="text-xs text-muted-foreground">None</Text>
        ) : (
          doc.ocrJobs.map((job) => (
            <Pressable key={job.id} onPress={() => router.push(`/(app)/ocr-jobs/${job.id}`)}>
              <Text className="text-xs text-primary mt-1">
                {formatJobStarted(job.startedAt)} (
                {job.platformKey !== "unknown" ? job.platformKey : "auto"},{" "}
                <Text className={cn("text-xs", OCR_JOB_STATUS_CLASS[job.status] ?? "")}>
                  {OCR_JOB_STATUS_LABEL[job.status] ?? job.status}
                </Text>
                )
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

export default function DocumentsScreen() {
  const { documents, isLoading, isError } = useDocuments();

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6 pb-24">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-foreground">Documents</Text>
          <Pressable onPress={() => router.push("/(app)/ocr-jobs")}>
            <Text className="text-sm text-primary">OCR jobs</Text>
          </Pressable>
        </View>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded statements</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <View className="gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </View>
            ) : null}

            {isError ? (
              <Text className="text-sm text-destructive py-4">
                Failed to load documents. Please try again.
              </Text>
            ) : null}

            {!isLoading && !isError && documents?.length === 0 ? (
              <Text className="text-sm text-muted-foreground py-10 text-center">
                No documents uploaded yet.
              </Text>
            ) : null}

            {!isLoading && !isError && documents && documents.length > 0
              ? documents.map((doc) => <DocumentRow key={doc.id} doc={doc} />)
              : null}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
