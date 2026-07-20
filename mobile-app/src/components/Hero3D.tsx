import { View, Text, Animated } from "react-native";
import { useRef, useEffect, memo } from "react";
import { Sparkles } from "lucide-react-native";

function Hero3D() {
  const rotateY = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const particleOpacity = useRef(new Animated.Value(0.5)).current;

  // Pre-compute complementary opacity so it doesn't create a new
  // Animated node on every render frame.
  const complementOpacity = useRef(Animated.subtract(1, particleOpacity)).current;

  // Single animation block — all loops share cleanup
  useEffect(() => {
    const rotation = Animated.loop(
      Animated.timing(rotateY, { toValue: 1, duration: 8000, useNativeDriver: true }),
    );
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(particleOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(particleOpacity, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ]),
    );

    rotation.start();
    float.start();
    shimmer.start();

    return () => {
      rotation.stop();
      float.stop();
      shimmer.stop();
    };
  }, [rotateY, translateY, particleOpacity]);

  const spinInterpolation = rotateY.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View className="items-center justify-center py-6">
      {/* Outer glow ring */}
      <View className="absolute w-48 h-48 rounded-full bg-[#F5C542]/10 blur-2xl" />

      {/* Floating particles */}
      <Animated.View style={{ opacity: particleOpacity }} className="absolute -top-4 left-8">
        <Sparkles size={16} color="#F5C542" />
      </Animated.View>
      <Animated.View style={{ opacity: complementOpacity }} className="absolute top-2 right-8">
        <Sparkles size={12} color="#8338EC" />
      </Animated.View>
      <Animated.View style={{ opacity: particleOpacity }} className="absolute bottom-4 left-12">
        <Sparkles size={14} color="#FB5607" />
      </Animated.View>

      {/* Centerpiece — rotating golden orb */}
      <Animated.View
        style={{ transform: [{ rotate: spinInterpolation }, { translateY }] }}
        className="items-center justify-center"
      >
        <View className="absolute w-36 h-36 rounded-full border-2 border-[#F5C542]/20" />
        <View className="absolute w-28 h-28 rounded-full border border-[#8338EC]/30 rotate-45" />
        <View className="absolute w-32 h-32 rounded-full border border-[#F5C542]/10 -rotate-12" />

        <View className="w-24 h-24 rounded-full bg-gradient-to-b from-[#F5C542] to-[#FB5607] items-center justify-center shadow-lg shadow-[#F5C542]/30">
          <Text className="text-4xl">💰</Text>
        </View>
      </Animated.View>

      {/* Jackpot text */}
      <View className="mt-6 items-center">
        <Text className="text-[#A0A4B8] text-sm font-bold uppercase tracking-widest mb-1">
          Win Big Today
        </Text>
        <Text className="text-[#F5C542] text-4xl font-black">Rs 500,000</Text>
      </View>
    </View>
  );
}

export default memo(Hero3D);