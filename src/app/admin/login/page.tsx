"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password.");
    } else {
      router.push("/admin/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#1E293B] bg-[#1A202C] p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold text-[#F8F9FA]">Admin Login</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Enter your admin credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="w-full rounded-xl border border-[#1E293B] bg-[#0B0F14] px-4 py-3 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:border-[#8338EC] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full rounded-xl border border-[#1E293B] bg-[#0B0F14] px-4 py-3 text-sm text-[#F8F9FA] placeholder:text-[#6B7280] focus:border-[#8338EC] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 px-4 py-3">
              <p className="text-sm text-[#EF4444]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#FB5607] px-4 py-3 text-sm font-extrabold text-[#F8F9FA] transition hover:bg-[#FF7B3D] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}