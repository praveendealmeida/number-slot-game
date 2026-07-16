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
        <span className="num font-semibold text-hi">
          {soldCount} / {TOTAL_SLOTS} Slots Sold
        </span>
        <span className="num font-semibold text-orange">
          {remainingSlots} Remaining
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-royal to-royal-tint transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
