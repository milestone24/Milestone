import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">Asset Detail</Text>
          <Text className="text-sm text-muted-foreground">Asset ID: {id}</Text>
          <Text className="text-sm text-muted-foreground mt-2">
            Full asset detail will be ported in a follow-up phase.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
