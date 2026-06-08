import { ScrollView, Text } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function DocumentsScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">Documents</Text>
          <Text className="text-sm text-muted-foreground">
            Document upload and management will be ported in a follow-up phase.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
