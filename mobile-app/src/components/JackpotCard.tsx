import { View, Text, Animated } from "react-native";
import { useRef, useEffect, memo } from "react";
import { Clock, Coins } from "lucide-react-native";

type JackpotCardProps = {
  amount: string;
  timeLeft: string;
};

function JackpotCard({ amount, timeLeft }: JackpotCardProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowAnim]);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#F5C54240", "#F5C54280"],
  });

  return (
    <Animated.View
      style={{ borderColor }}
      className="bg-[#1A202C] rounded-3xl p-6 border-2 overflow-hidden"
    >
      <View className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#F5C542]/5 rounded-full blur-xl" />

      <View className="items-center">
        <View className="flex-row items-center gap-2 mb-3">
          <Coins size={20} color="#F5C542" />
          <Text className="text-[#A0A4B8] text-sm font-bold uppercase tracking-widest">
            Today's Jackpot
          </Text>
        </View>

        <Text className="text-[#F5C542] text-5xl font-black tracking-tight mb-4" numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>

        <View className="flex-row items-center gap-2 bg-[#0B0F14] px-5 py-3 rounded-2xl border border-[#1E293B]">
          <Clock size={16} color="#FB5607" />
          <Text className="text-[#F8F9FA] text-lg font-mono font-bold">{timeLeft}</Text>
        </View>

        <View className="w-full mt-4 h-1 bg-[#0B0F14] rounded-full overflow-hidden">
          <View className="h-full w-3/4 bg-gradient-to-r from-[#8338EC] to-[#F5C542] rounded-full" />
        </View>
        <Text className="text-[#6B7280] text-xs mt-2">75% of tickets sold</Text>
      </View>
    </Animated.View>
  );
}

export default memo(JackpotCard);