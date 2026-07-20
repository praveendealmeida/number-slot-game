import { TouchableOpacity, Text, ActivityIndicator, Animated } from "react-native";
import { useRef, memo } from "react";

type Props = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "orange" | "royal" | "gold" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

function AnimatedButton({
  onPress,
  disabled = false,
  loading = false,
  variant = "orange",
  size = "md",
  className = "",
  children,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const bgMap = {
    orange: "bg-[#FB5607]",
    royal: "bg-[#8338EC]",
    gold: "bg-[#F5C542]",
    outline: "bg-transparent border border-[#334155]",
  };

  const textMap = {
    orange: "text-[#F8F9FA]",
    royal: "text-[#F8F9FA]",
    gold: "text-[#0B0F14]",
    outline: "text-[#F8F9FA]",
  };

  const sizeMap = {
    sm: "py-2 px-4 rounded-xl",
    md: "py-3 px-6 rounded-xl",
    lg: "py-4 px-8 rounded-2xl",
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        className={`items-center justify-center flex-row ${bgMap[variant]} ${sizeMap[size]} ${disabled ? "opacity-50" : ""} ${className}`}
      >
        {loading ? (
          <ActivityIndicator color={variant === "gold" ? "#0B0F14" : "#F8F9FA"} />
        ) : (
          typeof children === "string" ? (
            <Text className={`font-extrabold ${textMap[variant]} text-sm`}>{children}</Text>
          ) : (
            children
          )
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default memo(AnimatedButton);
