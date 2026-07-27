"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Stats = {
  totalUsers: number;
  verifiedUsers: number;
  todayRegistrations: number;
  todayEntries: number;
  activeGames: number;
  totalPayouts: number;
  todayRevenue: number;
  totalBalance: number;
};

function formatLkr(cents: number): string {
  return `Rs ${(cents / 100).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AdminDashboard() {
  const { user } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "ADMIN") { router.replace("/"); return; }
    if (user?.role === "ADMIN") {
      fetch("/api/admin/stats")
        .then((r) => r.json())
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [user, router]);

  if (!user || user.role !== "ADMIN") {
    return <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#A0A4B8]">Admin access required.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-[#F8F9FA] mb-2">Dashboard</h1>
      <p className="text-sm text-[#6B7280] mb-6">
        <Link href="/admin/games" className="text-[#8338EC] hover:underline">Games</Link>
        {" · "}
        <Link href="/admin/users" className="text-[#8338EC] hover:underline">Users</Link>
        {" · "}
        <Link href="/admin/daily-games" className="text-[#8338EC] hover:underline">Daily Games</Link>
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#1A202C] border border-[#1E293B]" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} color="#8338EC" />
            <StatCard label="Verified Users" value={stats.verifiedUsers.toLocaleString()} color="#22C55E" />
            <StatCard label="Today's Registrations" value={stats.todayRegistrations.toLocaleString()} color="#FB5607" />
            <StatCard label="Today's Entries" value={stats.todayEntries.toLocaleString()} color="#F5C542" />
            <StatCard label="Active Games" value={stats.activeGames.toLocaleString()} color="#9B5DE5" />
            <StatCard label="Today's Revenue" value={formatLkr(stats.todayRevenue)} color="#22C55E" />
            <StatCard label="Total Payouts" value={formatLkr(stats.totalPayouts)} color="#EF4444" />
            <StatCard label="Total Wallet Balance" value={formatLkr(stats.totalBalance)} color="#F5C542" />
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#1A202C] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-2 text-xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}