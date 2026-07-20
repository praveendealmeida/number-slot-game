import { View, Text, ScrollView } from "react-native";
import { memo } from "react";
import { Trophy } from "lucide-react-native";

const dummyWinners = [
  { name: "Kasun P.", amount: "Rs 25,000" },
  { name: "Nimal W.", amount: "Rs 10,000" },
  { name: "Saman J.", amount: "Rs 50,000" },
  { name: "Dilshan R.", amount: "Rs 15,000" },
  { name: "Priyantha M.", amount: "Rs 30,000" },
  { name: "Chamara K.", amount: "Rs 20,000" },
];

function WinnerTicker() {
  return (
    <View>
      <View className="flex-row items-center gap-2 mb-3">
        <Trophy size={16} color="#F5C542" />
        <Text className="text-[#F8F9FA] text-sm font-extrabold">Recent Winners</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {dummyWinners.map((w, i) => (
          <View
            key={i}
            className="flex-row items-center gap-1.5 bg-[#1A202C] px-3 py-2 rounded-xl border border-[#1E293B]"
          >
            <Text className="text-[#F5C542] text-xs">🏆</Text>
            <Text className="text-[#A0A4B8] text-xs font-medium">{w.name}</Text>
            <Text className="text-[#22C55E] text-xs font-bold">{w.amount}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(WinnerTicker);