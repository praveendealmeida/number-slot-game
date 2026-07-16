"use client";

import { formatSlotNumber } from "@/lib/slots";

type SlotGridProps = {
  soldSlots: number[];
  selected: number[];
  ownedByUser: number[];
  disabled: boolean;
  currentUserId: string | null;
  soldSlotOwners: Record<number, string>;
  onToggle: (slotNumber: number) => void;
};

export function SlotGrid({
  soldSlots,
  selected,
  ownedByUser,
  disabled,
  currentUserId,
  soldSlotOwners,
  onToggle,
}: SlotGridProps) {
  const soldSet = new Set(soldSlots);
  const selectedSet = new Set(selected);
  const ownedSet = new Set(ownedByUser);

  return (
    <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
      {Array.from({ length: 100 }, (_, index) => {
        const slotNumber = index;
        const label = formatSlotNumber(slotNumber);
        const isSold = soldSet.has(slotNumber);
        const isSelected = selectedSet.has(slotNumber);
        const isOwned = ownedSet.has(slotNumber);
        const isMine = isSold && currentUserId && soldSlotOwners[slotNumber] === currentUserId;

        let className =
          "num aspect-square rounded-lg text-xs font-bold transition sm:text-sm ";

        if (isSold) {
          className += isMine
            ? "cursor-not-allowed border border-royal-tint/60 bg-royal/25 text-royal-tint"
            : "cursor-not-allowed bg-line/70 text-low";
        } else if (isSelected) {
          className += "bg-gradient-to-b from-orange to-gold text-[#1C1006] shadow-[0_0_0_1px_rgba(250,204,21,0.4),0_4px_14px_rgba(250,204,21,0.3)]";
        } else if (disabled) {
          className += "cursor-not-allowed bg-card text-low ring-1 ring-line/60";
        } else {
          className += "bg-card text-hi ring-1 ring-line hover:ring-gold/60 hover:bg-card-soft";
        }

        return (
          <button
            key={slotNumber}
            type="button"
            disabled={disabled || isSold}
            aria-pressed={isSelected || isOwned}
            aria-label={`Slot ${label}${isSold ? " sold" : ""}`}
            onClick={() => onToggle(slotNumber)}
            className={className}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
