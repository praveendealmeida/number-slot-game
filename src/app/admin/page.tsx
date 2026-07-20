"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/context/UserContext";

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14]">
      <p className="text-[#A0A4B8]">Redirecting to dashboard...</p>
    </div>
  );
}
