import { useState } from "react";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import type { LoginInput } from "@milestone/js-common/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginScreen() {
  const { login, isLoginPending, error } = useSession();
  const [formData, setFormData] = useState<LoginInput>({
    email: "",
    password: "",
  });

  const handleSubmit = async () => {
    login(formData, {
      onSuccess: () => {
        router.replace("/(app)/(tabs)/portfolio");
      },
    });
  };

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Text className="text-3xl font-bold text-center text-foreground mb-8">
        Sign in to your account
      </Text>

      <View className="gap-3">
        <Input
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={formData.email}
          onChangeText={(email) => setFormData((prev) => ({ ...prev, email }))}
        />
        <Input
          placeholder="Password"
          secureTextEntry
          value={formData.password}
          onChangeText={(password) => setFormData((prev) => ({ ...prev, password }))}
        />
      </View>

      {error ? (
        <Text className="text-destructive text-sm text-center mt-3">{error.message}</Text>
      ) : null}

      <Button
        label={isLoginPending ? "Signing in..." : "Sign in"}
        className="mt-6"
        disabled={isLoginPending}
        onPress={handleSubmit}
      />

      <View className="flex-row justify-center mt-4">
        <Text className="text-muted-foreground text-sm">Don&apos;t have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text className="text-primary text-sm font-medium">Sign up</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
