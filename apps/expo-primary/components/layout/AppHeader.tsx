import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@milestone/js-common/react/hooks/use-session";

export function AppHeader() {
  const { logout } = useSession();

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-card">
      <Text className="text-lg font-semibold text-foreground">Milestone</Text>
      <View className="flex-row gap-3">
        <Pressable onPress={() => router.push("/(app)/profile")}>
          <Text className="text-sm text-primary">Profile</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/(app)/settings")}>
          <Text className="text-sm text-primary">Settings</Text>
        </Pressable>
        <Pressable onPress={() => logout()}>
          <Text className="text-sm text-destructive">Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}
