import { View, Text, Pressable, Animated } from "react-native";
import { useRef, useEffect, useCallback, memo } from "react";
import * as Haptics from "expo-haptics";
import { formatSlotNumber } from "@/lib/slots";

type SlotGridProps = {
  soldSlots: number[];
  selected: number[];
  ownedByUser: number[];
  disabled: boolean;
  currentUserId: string | null;
  soldSlotOwners: Record<number, string>;
  onToggle: (slotNumber: number) => void;
};

const SlotButton = memo(function SlotButton({
  slotNumber,
  label,
  isSold,
  isSelected,
  isMine,
  disabled,
  onPress,
  index,
}: {
  slotNumber: number;
  label: string;
  isSold: boolean;
  isSelected: boolean;
  isMine: boolean;
  disabled: boolean;
  onPress: () => void;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 20,
      damping: 12,
      stiffness: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, index]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.92,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = useCallback(() => {
    if (disabled || isSold) return;
    Haptics.impactAsync(
      isSelected ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    onPress();
  }, [disabled, isSold, isSelected, onPress]);

  let bg: string;
  let border: string;
  let textColor: string;

  if (isSold) {
    if (isMine) {
      bg = "bg-[#5B21B6]/25";
      border = "border-[#C4B5FD]/60";
      textColor = "text-[#C4B5FD]";
    } else {
      bg = "bg-[#27272A]/70";
      border = "border-transparent";
      textColor = "text-[#71717A]";
    }
  } else if (isSelected) {
    bg = "bg-gradient-to-b from-[#F97316] to-[#FACC15]";
    border = "border-transparent";
    textColor = "text-[#1C1006]";
  } else if (disabled) {
    bg = "bg-[#18181B]";
    border = "border-[#27272A]/60";
    textColor = "text-[#71717A]";
  } else {
    bg = "bg-[#18181B]";
    border = "border-[#27272A]";
    textColor = "text-[#FAFAFA]";
  }

  return (
    <Animated.View
      style={{
        opacity: scaleAnim,
        transform: [{ scale: pressAnim }],
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isSold}
        className={`aspect-square rounded-lg items-center justify-center border ${bg} ${border} ${
          isSelected ? "shadow-md shadow-[#FACC15]/30" : ""
        } ${!disabled && !isSold ? "active:opacity-80" : ""}`}
      >
        <Text
          className={`text-xs font-bold tabular-nums ${textColor} ${
            isSelected ? "text-[#1C1006]" : ""
          } ${isMine ? "text-[#C4B5FD]" : ""}`}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

export function SlotGrid({
  soldSlots,
  selected,
  ownedByUser,
  disabled,
  currentUserId,
  soldSlotOwners,
  onToggle,
}: SlotGridProps) {
  const soldSet = new Set(soldSlots);
  const selectedSet = new Set(selected);
  const ownedSet = new Set(ownedByUser);

  return (
    <View className="flex-row flex-wrap justify-between">
      {Array.from({ length: 100 }, (_, index) => {
        const slotNumber = index;
        const label = formatSlotNumber(slotNumber);
        const isSold = soldSet.has(slotNumber);
        const isSelected = selectedSet.has(slotNumber);
        const isOwned = ownedSet.has(slotNumber);
        const isMine = isSold && currentUserId !== null && soldSlotOwners[slotNumber] === currentUserId;

        return (
          <View key={slotNumber} className="w-[9.5%] mb-[3%]">
            <SlotButton
              slotNumber={slotNumber}
              label={label}
              isSold={isSold}
              isSelected={isSelected}
              isMine={isMine}
              disabled={disabled}
              onPress={() => onToggle(slotNumber)}
              index={index}
            />
          </View>
        );
      })}
    </View>
  );
}