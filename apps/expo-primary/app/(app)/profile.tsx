import { ScrollView, Text } from "react-native";
import { useSession } from "@milestone/js-common/react/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfileScreen() {
  const { user } = useSession();

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Card>
        <CardContent>
          <Text className="text-lg font-semibold text-foreground mb-2">Profile</Text>
          <Text className="text-foreground">{user?.account.fullName}</Text>
          <Text className="text-muted-foreground">{user?.account.email}</Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
