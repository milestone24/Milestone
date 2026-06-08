import { ScrollView, Text } from "react-native";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">Settings</Text>
          <Text className="text-sm text-muted-foreground">
            Settings screen will be fully ported in a follow-up phase.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
