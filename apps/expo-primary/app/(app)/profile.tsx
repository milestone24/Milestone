import { ScrollView, Text, View } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import { useProfile } from "@milestone/js-common/react/hooks/use-profile";
import type { UpdateProfileOrphanInput } from "@milestone/js-common/schema/user-account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserProfileForm } from "@/components/user/UserProfileForm";

export default function ProfileScreen() {
  const { user } = useSession();
  const { updateProfile } = useProfile();

  const joinDate = user?.account?.createdAt
    ? new Date(user.account.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "N/A";

  const handleProfileUpdate = async (data: UpdateProfileOrphanInput) => {
    await updateProfile.mutateAsync(data);
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-4 py-6 pb-24 gap-6">
        <Text className="text-2xl font-semibold text-foreground">My Profile</Text>

        <Card>
          <CardHeader>
            <CardTitle>Profile Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-xl font-semibold text-foreground">
              {user?.account.fullName || "User"}
            </Text>
            <Text className="text-muted-foreground">{user?.account.email || "Email not available"}</Text>
            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-sm text-muted-foreground">Member since</Text>
              <Text className="font-medium text-foreground">{joinDate}</Text>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <UserProfileForm onSubmit={handleProfileUpdate} data={user?.profile} />
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
