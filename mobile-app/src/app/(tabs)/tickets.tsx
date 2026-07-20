import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { fetchMyTickets, DailyTicketData } from "@/lib/api-client";
import { Ticket, Trophy, Clock, Star } from "lucide-react-native";
import { Skeleton } from "@/components/Skeleton";
import { useRouter } from "expo-router";

function formatBalance(cents: number): string {
  return `Rs ${(cents / 100).toFixed(0)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Waiting",
  WON: "WINNER",
  LOST: "No luck",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#F5C542",
  WON: "#22C55E",
  LOST: "#6B7280",
};

const STATUS_BG: Record<string, string> = {
  ACTIVE: "bg-[#F5C542]/10 border-[#F5C542]/20",
  WON: "bg-[#22C55E]/10 border-[#22C55E]/20",
  LOST: "bg-[#0B0F14] border-[#1E293B]",
};

export default function TicketsScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<DailyTicketData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyTickets();
      setTickets(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setLoading(false);
  }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-[#0B0F14] px-5 pt-12 items-center justify-center">
        <Ticket size={48} color="#1E293B" />
        <Text className="text-[#6B7280] text-sm mt-4 text-center">
          Sign in to view your tickets
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0B0F14]">
      <ScrollView className="flex-1 px-5 pt-12" showsVerticalScrollIndicator={false}>
        <Text className="text-[#F8F9FA] text-2xl font-extrabold mb-6">My Tickets</Text>

        {loading ? (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-[#1A202C]" />
            ))}
          </View>
        ) : error ? (
          <View className="items-center py-10">
            <Text className="text-[#EF4444] text-sm">{error}</Text>
            <Text className="text-[#6B7280] text-xs mt-2" onPress={load}>
              Tap to retry
            </Text>
          </View>
        ) : tickets && tickets.length > 0 ? (
          tickets.map((ticket) => (
            <View
              key={ticket.id}
              className={`rounded-2xl p-4 mb-3 border ${STATUS_BG[ticket.status] ?? "bg-[#1A202C] border-[#1E293B]"}`}
            >
              {/* Top row — number + status */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  {ticket.status === "WON" ? (
                    <Trophy size={18} color="#22C55E" />
                  ) : (
                    <Ticket size={18} color={STATUS_COLORS[ticket.status] ?? "#6B7280"} />
                  )}
                  <Text className="text-[#F8F9FA] text-base font-extrabold">
                    #{ticket.selectedNumber}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View
                    className="px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: STATUS_COLORS[ticket.status] + "1A" }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: STATUS_COLORS[ticket.status] }}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Middle row — game info */}
              <View className="flex-row items-center gap-2 mb-2">
                <Star size={12} color="#6B7280" />
                <Text className="text-[#A0A4B8] text-xs">
                  {ticket.game.title} · Entry {formatBalance(ticket.entryFee)}
                </Text>
              </View>

              {/* Bottom row — result or waiting */}
              {ticket.status === "WON" ? (
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-[#22C55E]/20">
                  <Text className="text-[#22C55E] text-sm font-extrabold">
                    +{formatBalance(ticket.game.prizeAmount)}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={10} color="#6B7280" />
                    <Text className="text-[#6B7280] text-xs">
                      {formatDate(ticket.createdAt)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-[#1E293B]">
                  {ticket.game.processed && ticket.game.winningNumber ? (
                    <Text className="text-[#6B7280] text-xs">
                      Winning: {ticket.game.winningNumber}
                    </Text>
                  ) : (
                    <Text className="text-[#6B7280] text-xs">Awaiting draw...</Text>
                  )}
                  <View className="flex-row items-center gap-1">
                    <Clock size={10} color="#6B7280" />
                    <Text className="text-[#6B7280] text-xs">
                      {formatDate(ticket.createdAt)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))
        ) : (
          <View className="items-center py-16">
            <Ticket size={48} color="#1E293B" />
            <Text className="text-[#6B7280] text-sm mt-4">No tickets yet</Text>
            <Text className="text-[#6B7280] text-xs mt-1 text-center">
              Your daily game entries will appear here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}