import { BottomNav } from "@/components/BottomNav";
import { UserBar } from "@/components/UserBar";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </header>
      <main className="space-y-4 px-4 py-4">
        <UserBar />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
