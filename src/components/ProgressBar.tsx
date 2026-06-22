import { TOTAL_SLOTS } from "@/lib/slots";

type ProgressBarProps = {
  soldCount: number;
  remainingSlots: number;
};

export function ProgressBar({ soldCount, remainingSlots }: ProgressBarProps) {
  const percent = Math.round((soldCount / TOTAL_SLOTS) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-zinc-900">
          {soldCount} / {TOTAL_SLOTS} Slots Sold
        </span>
        <span className="text-amber-700">{remainingSlots} Remaining</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
