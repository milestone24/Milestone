import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";

export default function AuthLayout() {
  const { isAuthenticated, isInitialUserLoading } = useSession();

  if (isInitialUserLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/portfolio" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
