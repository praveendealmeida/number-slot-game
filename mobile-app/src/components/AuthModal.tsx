import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { sendOTP } from "@/lib/api-client";

type AuthModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AuthModal({ visible, onClose, onSuccess }: AuthModalProps) {
  const { loginWithPhone } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const formatPhone = (input: string): string => {
    const digits = input.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length > 1) return "+94" + digits.slice(1);
    if (digits.length <= 9 && !digits.startsWith("94")) return digits;
    if (digits.startsWith("94")) return "+" + digits;
    return digits;
  };

  const isValidPhone = (): boolean => /^94\d{9}$/.test(phone.replace(/\D/g, ""));

  const handleSendOTP = async () => {
    setError(null);
    if (!isValidPhone()) {
      setError("Enter a valid Sri Lankan number.");
      return;
    }
    setLoading(true);
    try {
      const result = await sendOTP(phone);
      if (result.demoCode) setDemoCode(result.demoCode);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const getOtpString = (): string => otp.join("");

  const handleVerify = async () => {
    const code = getOtpString();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithPhone(phone, code);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const digits = text.replace(/\D/g, "");
    const newOtp = [...otp];
    if (digits.length > 1) {
      // Paste
      const pasted = digits.split("").slice(0, 6);
      for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || "";
      setOtp(newOtp);
    } else if (digits) {
      newOtp[index] = digits;
      setOtp(newOtp);
    } else {
      newOtp[index] = "";
      setOtp(newOtp);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    const code = getOtpString();
    if (code.length === 6 && step === "otp" && !loading) {
      handleVerify();
    }
  }, [otp, step]);

  const handleClose = () => {
    setStep("phone");
    setPhone("");
    setOtp(Array(6).fill(""));
    setError(null);
    setDemoCode(null);
    onClose();
  };

  const maskedPhone = phone.replace(/(\+94\d{2})\d{4}(\d{2})/, "$1*****$2");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-[#0B0F14]"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Close button */}
          <TouchableOpacity onPress={handleClose} className="absolute top-12 right-6 z-10">
            <Text className="text-[#D1D5DB] text-sm">Cancel</Text>
          </TouchableOpacity>

          {step === "phone" ? (
            <>
              <Text className="text-[#F8F9FA] text-2xl font-extrabold text-center mb-2">
                Enter your mobile number
              </Text>
              <Text className="text-[#D1D5DB] text-sm text-center mb-8">
                Sign in to play and win
              </Text>
              <View className="flex-row items-center bg-[#1A202C] rounded-2xl border border-[#1E293B] px-4 h-16 mb-6">
                <View className="border-r border-[#1E293B] pr-4 mr-3">
                  <Text className="text-[#F8F9FA] text-lg font-bold">+94</Text>
                </View>
                <TextInput
                  className="flex-1 text-[#F8F9FA] text-lg h-full"
                  placeholder="77 123 4567"
                  placeholderTextColor="#6B7280"
                  keyboardType="phone-pad"
                  maxLength={12}
                  value={phone}
                  onChangeText={(t) => { setPhone(formatPhone(t)); setError(null); }}
                  autoFocus
                />
              </View>
              {error && (
                <View className="mb-4 px-4 py-3 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/20">
                  <Text className="text-[#EF4444] text-sm text-center">{error}</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleSendOTP}
                disabled={loading || !isValidPhone()}
                activeOpacity={0.9}
                className={`w-full py-4 rounded-2xl items-center justify-center ${isValidPhone() && !loading ? "bg-[#FB5607]" : "bg-[#1E293B]"}`}
              >
                {loading ? (
                  <ActivityIndicator color="#F8F9FA" />
                ) : (
                  <Text className="text-[#F8F9FA] text-base font-extrabold">Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-[#F8F9FA] text-2xl font-extrabold text-center mb-2">
                Verify OTP
              </Text>
              <Text className="text-[#D1D5DB] text-sm text-center mb-2">
                Code sent to {maskedPhone}
              </Text>
              {demoCode && (
                <View className="mb-6 px-4 py-3 bg-[#8338EC]/10 rounded-xl border border-[#8338EC]/20">
                  <Text className="text-[#9B5DE5] text-sm text-center">
                    Demo OTP: <Text className="font-bold text-[#F5C542]">{demoCode}</Text>
                  </Text>
                </View>
              )}

              <View className="flex-row justify-center gap-2 mb-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    className={`w-12 h-16 rounded-xl border-2 items-center justify-center ${otp[i] ? "border-[#8338EC] bg-[#8338EC]/10" : "border-[#1E293B] bg-[#1A202C]"}`}
                  >
                    <TextInput
                      className="w-full h-full text-center text-[#F8F9FA] text-2xl font-bold"
                      keyboardType="number-pad"
                      maxLength={1}
                      value={otp[i]}
                      onChangeText={(t) => handleOtpChange(t, i)}
                      autoFocus={i === 0}
                    />
                  </View>
                ))}
              </View>

              {error && (
                <View className="mb-4 px-4 py-3 bg-[#EF4444]/10 rounded-xl border border-[#EF4444]/20">
                  <Text className="text-[#EF4444] text-sm text-center">{error}</Text>
                </View>
              )}

              {loading && (
                <View className="mb-4 items-center">
                  <ActivityIndicator color="#F5C542" />
                  <Text className="text-[#D1D5DB] text-sm mt-2">Verifying...</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => setStep("phone")} className="items-center">
                <Text className="text-[#D1D5DB] text-sm">Change number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}