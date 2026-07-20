import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { fetchWallet, WalletData } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react-native";

function formatBalance(cents: number): string {
  return `Rs ${(cents / 100).toFixed(0)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TYPE_COLORS: Record<string, string> = {
  DEPOSIT: "text-[#22C55E]",
  WINNING: "text-[#F5C542]",
  GAME_ENTRY: "text-[#FB5607]",
  BONUS: "text-[#8338EC]",
};

const TYPE_ICONS: Record<string, string> = {
  DEPOSIT: "↓",
  WINNING: "🏆",
  GAME_ENTRY: "🎯",
  BONUS: "🎁",
};

export default function WalletScreen() {
  const { isAuthenticated } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchWallet();
      setWallet(data);
    } catch {
      // Silent — wallet may be empty for non-authenticated users
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAuthenticated) load(); else setLoading(false); }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-[#0B0F14] px-5 pt-12 items-center justify-center">
        <WalletIcon size={48} color="#1E293B" />
        <Text className="text-[#6B7280] text-sm mt-4">Sign in to view your wallet</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0B0F14]">
      <ScrollView className="flex-1 px-5 pt-12" showsVerticalScrollIndicator={false}>
        <Text className="text-[#F8F9FA] text-2xl font-extrabold mb-6">Wallet</Text>

        {/* Balance Card */}
        <View className="bg-[#1A202C] rounded-3xl p-6 border border-[#1E293B] mb-6">
          <Text className="text-[#A0A4B8] text-sm font-medium mb-2">Your Balance</Text>
          <Text className="text-[#F5C542] text-4xl font-black mb-4">
            {wallet ? formatBalance(wallet.balance) : "—"}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-[#FB5607] rounded-xl py-3 items-center">
              <Text className="text-[#F8F9FA] text-sm font-extrabold">Deposit</Text>
            </View>
            <View className="flex-1 bg-[#1E293B] rounded-xl py-3 items-center border border-[#334155]">
              <Text className="text-[#F8F9FA] text-sm font-extrabold">Withdraw</Text>
            </View>
          </View>
        </View>

        {/* Transactions */}
        <Text className="text-[#F8F9FA] text-lg font-extrabold mb-4">Transactions</Text>

        {wallet && wallet.transactions.length > 0 ? (
          wallet.transactions.map((tx) => (
            <View
              key={tx.id}
              className="flex-row items-center bg-[#1A202C] rounded-xl p-4 mb-2 border border-[#1E293B]"
            >
              <View className="w-10 h-10 rounded-xl bg-[#0B0F14] items-center justify-center mr-3">
                <Text className="text-lg">{TYPE_ICONS[tx.type] ?? "•"}</Text>
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-[#F8F9FA] text-sm font-bold">
                  {tx.description ?? tx.type.replace("_", " ")}
                </Text>
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Clock size={10} color="#6B7280" />
                  <Text className="text-[#6B7280] text-xs">{formatDate(tx.createdAt)}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className={`text-sm font-extrabold ${tx.amount > 0 ? "text-[#22C55E]" : "text-[#FB5607]"}`}>
                  {tx.amount > 0 ? "+" : ""}{formatBalance(tx.amount)}
                </Text>
                <Text className="text-[#6B7280] text-xs mt-0.5">Bal: {formatBalance(tx.balanceAfter)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className="items-center py-10">
            <WalletIcon size={40} color="#1E293B" />
            <Text className="text-[#6B7280] text-sm mt-3">No transactions yet</Text>
            <Text className="text-[#6B7280] text-xs mt-1">Your game and deposit history will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}