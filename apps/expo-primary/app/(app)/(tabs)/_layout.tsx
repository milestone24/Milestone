import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useRecordTransaction } from "@milestone/js-common/react/context/RecordTransactionContext";
import { AppHeader } from "@/components/layout/AppHeader";

function RecordTabButton() {
  const { openTransaction } = useRecordTransaction();

  return (
    <Pressable
      className="items-center justify-center -mt-4"
      onPress={() => openTransaction()}
      accessibilityRole="button"
      accessibilityLabel="Record"
    >
      <View className="w-14 h-14 rounded-full bg-primary items-center justify-center">
        <SymbolView name={{ ios: "plus", android: "add", web: "add" }} size={28} tintColor="#fff" />
      </View>
      <Text className="text-xs text-muted-foreground mt-1">Record</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View className="flex-1 bg-background">
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#3b82f6",
          tabBarInactiveTintColor: "#71717a",
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: "#e4e4e7",
            paddingBottom: 4,
            height: 64,
          },
        }}
      >
        <Tabs.Screen
          name="portfolio"
          options={{
            title: "Portfolio",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: "square.grid.2x2", android: "grid_view", web: "grid_view" }}
                size={22}
                tintColor={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            title: "Goals",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: "clock", android: "schedule", web: "schedule" }}
                size={22}
                tintColor={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            title: "Record",
            tabBarButton: () => <RecordTabButton />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: "Track",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: "chart.line.uptrend.xyaxis", android: "trending_up", web: "trending_up" }}
                size={22}
                tintColor={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="fire"
          options={{
            title: "FIRE",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: "star.fill", android: "star", web: "star" }}
                size={22}
                tintColor={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
