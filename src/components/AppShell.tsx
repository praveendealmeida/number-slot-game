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
    <div className="mx-auto min-h-screen max-w-lg bg-base pb-24">
      <header className="sticky top-0 z-40 border-b border-line bg-gradient-to-b from-royal-deep via-royal to-royal-soft px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        <h1 className="text-xl font-extrabold text-hi">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-royal-tint/80">{subtitle}</p>
        ) : null}
      </header>
      <main className="space-y-4 px-4 py-4">
        <UserBar />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
