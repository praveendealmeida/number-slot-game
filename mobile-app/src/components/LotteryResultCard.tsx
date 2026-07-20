import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useRef, useEffect, memo } from "react";
import { Star, ArrowRight } from "lucide-react-native";

type LotteryResultCardProps = {
  drawNumber: string;
  drawDate: string;
  ticketNumber: string;
  winningNumber: string;
  isAuthenticated: boolean;
  onPlay: () => void;
};

function LotteryResultCard({
  drawNumber,
  drawDate,
  ticketNumber,
  winningNumber,
  isAuthenticated,
  onPlay,
}: LotteryResultCardProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Arrow slide animation
  useEffect(() => {
    const slide = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    slide.start();
    return () => slide.stop();
  }, [arrowAnim]);

  const arrowTranslateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  const ticketDigits = ticketNumber.replace(/\D/g, "").split("");
  const winningDigits = winningNumber.replace(/\D/g, "").split("");
  const lastTwoIndices = ticketDigits.length - 2;

  return (
    <View className="bg-[#1A202C] rounded-3xl overflow-hidden border border-[#1E293B]">
      {/* Top gradient accent */}
      <View className="h-1 bg-gradient-to-r from-[#8338EC] via-[#F5C542] to-[#FB5607]" />

      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center gap-2 mb-4">
          <Text className="text-lg">🇱🇰</Text>
          <Text className="text-[#F8F9FA] text-base font-extrabold flex-1">
            Today's Mahajana Sampatha
          </Text>
        </View>

        {/* Draw info */}
        <View className="flex-row justify-between mb-4">
          <View>
            <Text className="text-[#6B7280] text-xs mb-0.5">Draw No</Text>
            <Text className="text-[#A0A4B8] text-sm font-bold">{drawNumber}</Text>
          </View>
          <View>
            <Text className="text-[#6B7280] text-xs mb-0.5 text-right">Date</Text>
            <Text className="text-[#A0A4B8] text-sm font-bold">{drawDate}</Text>
          </View>
        </View>

        {/* Ticket digits row */}
        <View className="flex-row justify-center gap-1.5 mb-4">
          {ticketDigits.map((digit, i) => {
            const isLastTwo = i >= lastTwoIndices;
            return (
              <View
                key={i}
                className={`w-8 h-10 rounded-lg items-center justify-center ${
                  isLastTwo
                    ? "bg-[#F5C542]/20 border border-[#F5C542]/40"
                    : "bg-[#0B0F14] border border-[#1E293B]"
                }`}
              >
                <Text
                  className={`text-sm font-extrabold ${
                    isLastTwo ? "text-[#F5C542]" : "text-[#6B7280]"
                  }`}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Winning number */}
        <View className="items-center">
          <View className="flex-row items-center gap-2 mb-2">
            <Star size={14} color="#F5C542" />
            <Text className="text-[#A0A4B8] text-xs font-bold uppercase tracking-widest">
              Winning Number
            </Text>
          </View>

          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="flex-row gap-2"
          >
            {winningDigits.map((digit, i) => (
              <View
                key={i}
                className="w-12 h-14 rounded-xl bg-[#F5C542] items-center justify-center shadow-lg shadow-[#F5C542]/30"
              >
                <Text className="text-[#0B0F14] text-2xl font-black">{digit}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={onPlay}
          activeOpacity={0.9}
          className="mt-5 bg-[#FB5607] rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
        >
          <Text className="text-[#F8F9FA] text-sm font-extrabold">
            {isAuthenticated ? "Play Today's Number" : "Sign in to Play"}
          </Text>
          <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
            <ArrowRight size={16} color="#F8F9FA" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(LotteryResultCard);