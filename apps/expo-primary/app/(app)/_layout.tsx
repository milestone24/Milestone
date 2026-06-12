import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";

export default function AppLayout() {
  const { isAuthenticated, isInitialUserLoading } = useSession();

  if (isInitialUserLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ presentation: "card", headerShown: true, title: "Profile" }} />
      <Stack.Screen name="settings" options={{ presentation: "card", headerShown: true, title: "Settings" }} />
      <Stack.Screen name="api-connections" options={{ presentation: "card", headerShown: true, title: "API Connections" }} />
      <Stack.Screen name="documents" options={{ presentation: "card", headerShown: true, title: "Documents" }} />
      <Stack.Screen name="ocr-jobs/index" options={{ presentation: "card", headerShown: true, title: "OCR Jobs" }} />
      <Stack.Screen name="ocr-jobs/[id]" options={{ presentation: "card", headerShown: true, title: "OCR Job" }} />
      <Stack.Screen name="asset/[id]" options={{ presentation: "card", headerShown: true, title: "Asset" }} />
    </Stack>
  );
}
