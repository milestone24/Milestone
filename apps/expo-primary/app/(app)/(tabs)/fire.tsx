import { ScrollView, Text, View } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function FireScreen() {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 pb-24">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">FIRE Calculator</Text>
          <Text className="text-sm text-muted-foreground">
            The full FIRE calculator will be ported in a follow-up phase. Use the web client for
            detailed FIRE planning in the meantime.
          </Text>
        </CardContent>
      </Card>
      </View>
    </ScrollView>
  );
}
