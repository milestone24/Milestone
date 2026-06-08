import { useState } from "react";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import type { RegisterInput } from "@milestone/js-common/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterScreen() {
  const { register, isRegisterPending, error } = useSession();
  const [formData, setFormData] = useState<RegisterInput>({
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
  });

  const handleSubmit = async () => {
    register(formData, {
      onSuccess: () => {
        router.replace("/(app)/(tabs)/portfolio");
      },
    });
  };

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Text className="text-3xl font-bold text-center text-foreground mb-8">
        Create your account
      </Text>

      <View className="gap-3">
        <Input
          placeholder="Full Name"
          value={formData.fullName}
          onChangeText={(fullName) => setFormData((prev) => ({ ...prev, fullName }))}
        />
        <Input
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={formData.email}
          onChangeText={(email) => setFormData((prev) => ({ ...prev, email }))}
        />
        <Input
          placeholder="Phone Number (optional)"
          keyboardType="phone-pad"
          value={formData.phoneNumber ?? ""}
          onChangeText={(phoneNumber) => setFormData((prev) => ({ ...prev, phoneNumber }))}
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
        label={isRegisterPending ? "Creating account..." : "Sign up"}
        className="mt-6"
        disabled={isRegisterPending}
        onPress={handleSubmit}
      />

      <View className="flex-row justify-center mt-4">
        <Text className="text-muted-foreground text-sm">Already have an account? </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text className="text-primary text-sm font-medium">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
