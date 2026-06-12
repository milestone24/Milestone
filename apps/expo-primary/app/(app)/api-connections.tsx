import { ScrollView, Text } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function ApiConnectionsScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">API Connections</Text>
          <Text className="text-sm text-muted-foreground">
            Broker API connections will be ported in a follow-up phase.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
