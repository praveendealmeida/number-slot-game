import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { sendOTP } from "@/lib/api-client";

export default function PhoneAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const redirectTarget = params.redirect || "/(tabs)";

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const formatPhone = (input: string): string => {
    // Strip everything except digits
    const digits = input.replace(/\D/g, "");

    // If user starts typing "0...", strip the 0 and prefix +94
    if (digits.startsWith("0") && digits.length > 1) {
      return "+94" + digits.slice(1);
    }

    // If 9 digits without prefix, assume +94
    if (digits.length <= 9 && !digits.startsWith("94")) {
      return digits;
    }

    // If starts with 94
    if (digits.startsWith("94")) {
      return "+" + digits;
    }

    return digits;
  };

  const isValid = (): boolean => {
    const digits = phone.replace(/\D/g, "");
    // +947XXXXXXXX — 12 chars with +94 prefix
    return /^94\d{9}$/.test(digits);
  };

  const handleSendOTP = async () => {
    setError(null);
    setDemoCode(null);

    if (!isValid()) {
      setError("Enter a valid Sri Lankan mobile number (0771234567 or +94771234567).");
      return;
    }

    setLoading(true);
    try {
      const result = await sendOTP(phone);
      if (result.demoCode) {
        setDemoCode(result.demoCode);
      }
      // Navigate to OTP screen, passing the phone number
      router.push({
        pathname: "/auth/verify-otp",
        params: { phone, redirect: redirectTarget },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
    setError(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#09090B]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-[#FAFAFA] text-3xl font-extrabold text-center">
              Enter your{"\n"}mobile number
            </Text>
            <Text className="text-[#D1D5DB] text-sm mt-3 text-center">
              We'll send you a verification code
            </Text>
          </View>

          {/* Phone Input */}
          <View className="mb-6">
            <View className="flex-row items-center bg-[#18181B] rounded-2xl border border-[#27272A] px-4 h-16 focus:border-[#5B21B6]">
              {/* +94 prefix */}
              <View className="border-r border-[#27272A] pr-4 mr-3">
                <Text className="text-[#FAFAFA] text-lg font-bold">+94</Text>
              </View>

              <TextInput
                className="flex-1 text-[#FAFAFA] text-lg h-full"
                placeholder="77 123 4567"
                placeholderTextColor="#71717A"
                keyboardType="phone-pad"
                maxLength={12}
                value={phone}
                onChangeText={handlePhoneChange}
                autoFocus
              />
            </View>
          </View>

          {/* Demo OTP notice */}
          {demoCode && (
            <View className="mb-4 px-4 py-3 bg-[#2E1065]/40 rounded-xl border border-[#5B21B6]/30">
              <Text className="text-[#C4B5FD] text-sm text-center">
                Demo OTP: <Text className="font-bold text-[#FACC15]">{demoCode}</Text>
              </Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View className="mb-4 px-4 py-3 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/20">
              <Text className="text-[#EF4444] text-sm text-center">{error}</Text>
            </View>
          )}

          {/* Send OTP Button */}
          <TouchableOpacity
            onPress={handleSendOTP}
            disabled={loading || !isValid()}
            activeOpacity={0.9}
            className={`w-full py-4 rounded-2xl items-center justify-center ${
              isValid() && !loading
                ? "bg-[#F97316]"
                : "bg-[#27272A]"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#FAFAFA" />
            ) : (
              <Text className="text-[#FAFAFA] text-base font-extrabold">
                Send OTP
              </Text>
            )}
          </TouchableOpacity>

          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 items-center"
          >
            <Text className="text-[#D1D5DB] text-sm">Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}