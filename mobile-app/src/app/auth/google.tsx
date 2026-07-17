import { View, Text, SafeAreaView } from "react-native";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function GoogleAuthScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/lobby");
    }
  }, [isAuthenticated, router]);

  return (
    <SafeAreaView className="flex-1 bg-[#09090B] items-center justify-center">
      <View className="items-center space-y-4">
        <View className="w-12 h-12 rounded-full border-2 border-[#27272A] items-center justify-center">
          <Text className="text-[#FAFAFA] text-lg">G</Text>
        </View>
        <Text className="text-[#A1A1AA] text-sm">Signing in with Google...</Text>
      </View>
    </SafeAreaView>
  );
}