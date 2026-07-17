import { View, Text } from "react-native";
import { TOTAL_SLOTS } from "@/lib/slots";

type ProgressBarProps = {
  soldCount: number;
  remainingSlots: number;
};

export function ProgressBar({ soldCount, remainingSlots }: ProgressBarProps) {
  const percent = Math.round((soldCount / TOTAL_SLOTS) * 100);

  return (
    <View className="space-y-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-[#FAFAFA] tabular-nums">
          {soldCount} / {TOTAL_SLOTS} Sold
        </Text>
        <Text className="text-[11px] font-semibold text-[#F97316] tabular-nums">
          {remainingSlots} Left
        </Text>
      </View>
      {/* Track */}
      <View className="h-2.5 overflow-hidden rounded-full bg-[#27272A]">
        {/* Fill */}
        <View
          className="h-full rounded-full bg-gradient-to-r from-[#5B21B6] to-[#C4B5FD]"
          style={{ width: `${percent}%` }}
        />
      </View>
    </View>
  );
}