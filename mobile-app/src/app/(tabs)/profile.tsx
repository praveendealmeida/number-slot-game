import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { User, LogOut, Shield, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, isAuthenticated, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View className="flex-1 bg-[#0B0F14]">
      <ScrollView className="flex-1 px-5 pt-12">
        <Text className="text-[#F8F9FA] text-2xl font-extrabold mb-6">Profile</Text>

        {isAuthenticated && user ? (
          <>
            {/* User Info Card */}
            <View className="bg-[#1A202C] rounded-2xl p-5 border border-[#1E293B] mb-6">
              <View className="flex-row items-center gap-4 mb-4">
                <View className="w-14 h-14 rounded-full bg-[#8338EC]/20 border border-[#8338EC]/30 items-center justify-center">
                  <User size={24} color="#9B5DE5" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#F8F9FA] text-lg font-extrabold" numberOfLines={1}>
                    {user.name || "Player"}
                  </Text>
                  <Text className="text-[#A0A4B8] text-sm" numberOfLines={1}>
                    {user.phoneNumber || user.email}
                  </Text>
                </View>
              </View>

              <View className="bg-[#0B0F14] rounded-xl p-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Shield size={16} color={user.kycLevel >= 1 ? "#22C55E" : "#6B7280"} />
                  <Text className="text-[#A0A4B8] text-sm font-medium">KYC Tier {user.kycLevel}</Text>
                </View>
                <Text className="text-[#6B7280] text-xs">
                  {["Guest", "Registered", "Verified Player", "Premium"][user.kycLevel] ?? "Unknown"}
                </Text>
              </View>
            </View>

            <View className="bg-[#1A202C] rounded-2xl border border-[#1E293B] overflow-hidden mb-6">
              <MenuItem icon={<User size={18} color="#A0A4B8" />} label="Edit Profile" />
              <MenuItem icon={<Shield size={18} color="#A0A4B8" />} label="KYC Verification" />
              <MenuItem
                icon={<LogOut size={18} color="#EF4444" />}
                label="Sign Out"
                onPress={handleSignOut}
                danger
              />
            </View>
          </>
        ) : (
          <View className="items-center py-16">
            <View className="w-20 h-20 rounded-full bg-[#1A202C] border border-[#1E293B] items-center justify-center mb-4">
              <User size={32} color="#6B7280" />
            </View>
            <Text className="text-[#F8F9FA] text-lg font-extrabold mb-2">Sign in to continue</Text>
            <Text className="text-[#6B7280] text-sm text-center mb-6 px-4">
              Sign in to track your games, manage your wallet, and view your profile.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/auth/phone")}
              className="bg-[#FB5607] px-8 py-3 rounded-xl"
            >
              <Text className="text-[#F8F9FA] text-sm font-extrabold">Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between px-5 py-4 border-b border-[#1E293B] last:border-b-0"
    >
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className={`text-sm font-medium ${danger ? "text-[#EF4444]" : "text-[#F8F9FA]"}`}>
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color="#6B7280" />
    </TouchableOpacity>
  );
}