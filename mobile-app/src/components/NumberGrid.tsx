import { useEffect, useRef, memo } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";

type NumberGridProps = {
  selected: string | null;
  onSelect: (num: string) => void;
  disabled?: string[];
};

const ALL_NUMBERS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, "0"));

function NumberGrid({ selected, onSelect, disabled = [] }: NumberGridProps) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {ALL_NUMBERS.map((num) => {
        const isSelected = selected === num;
        const isDisabled = disabled.includes(num);

        return (
          <NumberCell
            key={num}
            number={num}
            selected={isSelected}
            disabled={isDisabled}
            onPress={() => onSelect(num)}
          />
        );
      })}
    </View>
  );
}

type CellProps = {
  number: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
};

function NumberCell({ number, selected, disabled, onPress }: CellProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
  }, [selected, scaleAnim]);

  const bgClass = selected
    ? "bg-[#F5C542] border-[#F5C542]"
    : disabled
      ? "bg-[#0B0F14] border-[#1E293B] opacity-30"
      : "bg-[#1A202C] border-[#1E293B]";

  const textClass = selected
    ? "text-[#0B0F14]"
    : disabled
      ? "text-[#6B7280]"
      : "text-[#A0A4B8]";

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        className={`w-[calc(10vw-6px)] max-w-[44px] h-12 rounded-xl border items-center justify-center ${bgClass}`}
      >
        <Text className={`text-xs font-extrabold ${textClass}`}>{number}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default memo(NumberGrid);