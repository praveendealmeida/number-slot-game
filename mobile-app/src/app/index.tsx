import { View, Text, TouchableOpacity, SafeAreaView, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/constants/colors";

export default function LoginScreen() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace("/lobby");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090B] items-center justify-center">
        <Text className="text-[#A1A1AA] text-sm font-medium">Loading...</Text>
      </SafeAreaView>
    );
  }

  const handleGoogleSignIn = () => {
    // In a real app, this would use expo-auth-session or expo-web-browser
    // to trigger Google OAuth. For now, we navigate to the sign-in flow.
    router.push("/auth/google");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#09090B]">
      {/* Background gradient effect */}
      <View className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-[#2E1065]/40 to-transparent" />

      <View className="flex-1 px-6 justify-between pb-10">
        {/* Top section - Branding */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="flex-1 items-center justify-center"
        >
          {/* Decorative rings */}
          <View className="items-center justify-center mb-8">
            <View className="absolute w-32 h-32 rounded-full border-2 border-[#5B21B6]/30" />
            <View className="absolute w-28 h-28 rounded-full border border-[#C4B5FD]/15" />
            <View className="w-24 h-24 rounded-full bg-gradient-to-b from-[#5B21B6] to-[#4C1D95] items-center justify-center shadow-lg shadow-[#5B21B6]/40">
              <Text className="text-3xl">🎰</Text>
            </View>
          </View>

          <Text className="text-[#FAFAFA] text-4xl font-extrabold tracking-tight text-center">
            Lucky{" "}
            <Text className="text-[#FACC15]">Lanka</Text>
          </Text>
          <Text className="text-[#A1A1AA] text-base mt-2 text-center leading-6">
            Pick your numbers, win big prizes.
          </Text>
          <Text className="text-[#71717A] text-sm mt-1 text-center">
            100-slot number guessing game
          </Text>

          {/* Feature highlights */}
          <View className="mt-12 w-full max-w-xs space-y-4">
            <FeatureRow icon="🎯" text="Choose from 5 price tiers" />
            <FeatureRow icon="🏆" text="Win up to 70% of the prize pool" />
            <FeatureRow icon="⚡" text="Real-time slot availability" />
            <FeatureRow icon="🔒" text="Secure Google sign-in" />
          </View>
        </Animated.View>

        {/* Bottom section - Sign In */}
        <Animated.View
          style={{
            opacity: fadeAnim,
          }}
          className="space-y-4"
        >
          {/* Decorative divider */}
          <View className="flex-row items-center mb-2">
            <View className="flex-1 h-[1px] bg-[#27272A]" />
            <Text className="text-[#71717A] text-xs mx-4 font-medium uppercase tracking-widest">
              Get Started
            </Text>
            <View className="flex-1 h-[1px] bg-[#27272A]" />
          </View>

          <TouchableOpacity
            onPress={handleGoogleSignIn}
            activeOpacity={0.9}
            className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F97316] to-[#FACC15] items-center justify-center flex-row shadow-lg shadow-[#F97316]/30"
          >
            <View className="w-6 h-6 bg-white rounded-full items-center justify-center mr-3">
              <Text className="text-[#09090B] text-xs font-bold">G</Text>
            </View>
            <Text className="text-[#1C1006] text-base font-extrabold">
              Sign in with Google
            </Text>
          </TouchableOpacity>

          <Text className="text-[#71717A] text-xs text-center leading-5">
            By signing in, you agree to our{"\n"}Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] items-center justify-center">
        <Text className="text-base">{icon}</Text>
      </View>
      <Text className="text-[#C4B5FD] text-sm font-medium">{text}</Text>
    </View>
  );
}