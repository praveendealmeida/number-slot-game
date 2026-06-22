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
          "aspect-square rounded-lg text-xs font-semibold transition sm:text-sm ";

        if (isSold) {
          className += isMine
            ? "cursor-not-allowed bg-blue-100 text-blue-800"
            : "cursor-not-allowed bg-zinc-200 text-zinc-500";
        } else if (isSelected) {
          className += "bg-emerald-600 text-white shadow-md";
        } else if (disabled) {
          className += "cursor-not-allowed bg-zinc-100 text-zinc-400";
        } else {
          className += "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-emerald-50";
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
