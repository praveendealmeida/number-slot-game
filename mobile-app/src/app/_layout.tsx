import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <View className="flex-1 bg-[#0B0F14]">
          <StatusBar style="light" />
          <Slot />
        </View>
      </AuthProvider>
    </QueryClientProvider>
  );
}