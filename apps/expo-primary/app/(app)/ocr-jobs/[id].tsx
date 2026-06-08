import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function OcrJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">OCR Job</Text>
          <Text className="text-sm text-muted-foreground">Job ID: {id}</Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
