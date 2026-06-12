import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@milestone/js-common/react/context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const themeOptions = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
  { value: "system" as const, label: "System" },
];

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6 pb-24 gap-6">
        <Text className="text-2xl font-semibold text-foreground">Settings</Text>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-muted-foreground mb-3">Theme</Text>
            <View className="flex-row gap-2">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  label={option.label}
                  className={cn("flex-1")}
                  onPress={() => setTheme(option.value)}
                />
              ))}
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>More settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-muted-foreground">
              Email ingest, API keys, notifications, and data export remain on the web client for
              now.
            </Text>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
