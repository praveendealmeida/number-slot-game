import { useState, useRef, useEffect, useCallback } from "react";
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
import { useAuth } from "@/context/AuthContext";

const OTP_LENGTH = 6;

export default function VerifyOTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; redirect?: string }>();
  const phone = params.phone || "";
  const redirectTarget = params.redirect || "/lobby";

  const { loginWithPhone } = useAuth();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyingRef = useRef(false);

  // Auto-focus the first input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const getOtpString = (): string => otp.join("");

  const handleVerify = useCallback(async () => {
    const code = getOtpString();
    if (code.length !== OTP_LENGTH || verifyingRef.current) return;

    verifyingRef.current = true;
    setError(null);
    setLoading(true);

    try {
      await loginWithPhone(phone, code);
      router.replace(redirectTarget as never);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      verifyingRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [otp, phone, redirectTarget, loginWithPhone, router]);

  // Auto-verify when all 6 digits are entered
  useEffect(() => {
    const code = getOtpString();
    if (code.length === OTP_LENGTH && !verifyingRef.current) {
      handleVerify();
    }
  }, [otp, handleVerify]);

  const focusPrevious = (index: number) => {
    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleInputChange = (text: string, index: number) => {
    if (verifyingRef.current) return;

    // Handle paste
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").split("").slice(0, OTP_LENGTH);
      const newOtp = [...Array(OTP_LENGTH).fill("")];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = digits.length < OTP_LENGTH ? digits.length : OTP_LENGTH - 1;
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = text.replace(/\D/g, "");
    const newOtp = [...otp];

    if (digit) {
      newOtp[index] = digit;
      setOtp(newOtp);
      focusNext(index);
    } else {
      // Backspace: clear current and move back
      newOtp[index] = "";
      setOtp(newOtp);
      focusPrevious(index);
    }
  };

  const isComplete = getOtpString().length === OTP_LENGTH;

  // Mask phone for display: +9477*****67
  const maskedPhone = phone.replace(/(\+94\d{2})\d{4}(\d{2})/, "$1*****$2");

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
              Verify OTP
            </Text>
            <Text className="text-[#A1A1AA] text-sm mt-3 text-center">
              Enter the 6-digit code sent to{"\n"}
              <Text className="text-[#C4B5FD] font-medium">{maskedPhone}</Text>
            </Text>
          </View>

          {/* OTP Input Boxes */}
          <View className="flex-row justify-center gap-3 mb-8">
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <View
                key={i}
                className={`w-12 h-16 rounded-xl border-2 items-center justify-center ${
                  otp[i]
                    ? "border-[#5B21B6] bg-[#2E1065]/20"
                    : "border-[#27272A] bg-[#18181B]"
                }`}
              >
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[i] = ref;
                  }}
                  className="w-full h-full text-center text-[#FAFAFA] text-2xl font-bold"
                  keyboardType="number-pad"
                  maxLength={1}
                  value={otp[i]}
                  onChangeText={(text) => handleInputChange(text, i)}
                  selectTextOnFocus
                  editable={!verifyingRef.current}
                />
              </View>
            ))}
          </View>

          {/* Demo help text */}
          <View className="mb-4 px-4 py-3 bg-[#2E1065]/40 rounded-xl border border-[#5B21B6]/30">
            <Text className="text-[#C4B5FD] text-sm text-center">
              Demo OTP: <Text className="font-bold text-[#FACC15]">123456</Text>
            </Text>
          </View>

          {/* Loading */}
          {loading && (
            <View className="mb-4 items-center">
              <ActivityIndicator color="#FACC15" />
              <Text className="text-[#A1A1AA] text-sm mt-2">Verifying...</Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View className="mb-4 px-4 py-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <Text className="text-red-400 text-sm text-center">{error}</Text>
            </View>
          )}

          {/* Verify button (manual fallback) */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={loading || !isComplete}
            activeOpacity={0.9}
            className={`w-full py-4 rounded-2xl items-center justify-center mb-4 ${
              isComplete && !loading
                ? "bg-[#F97316]"
                : "bg-[#27272A]"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#FAFAFA" />
            ) : (
              <Text className="text-[#FAFAFA] text-base font-extrabold">
                Verify
              </Text>
            )}
          </TouchableOpacity>

          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center"
          >
            <Text className="text-[#A1A1AA] text-sm">Change number</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}