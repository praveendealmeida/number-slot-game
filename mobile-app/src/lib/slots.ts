export const TOTAL_SLOTS = 100;
export const MIN_SLOT = 0;
export const MAX_SLOT = 99;

export function formatSlotNumber(slotNumber: number): string {
  return slotNumber.toString().padStart(2, "0");
}

export function parseSlotNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= MIN_SLOT && value <= MAX_SLOT ? value : null;
  }

  if (typeof value === "string" && /^\d{1,2}$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed >= MIN_SLOT && parsed <= MAX_SLOT ? parsed : null;
  }

  return null;
}

export function normalizeSlotNumbers(values: unknown): number[] | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const parsed = values.map(parseSlotNumber);
  if (parsed.some((slot) => slot === null)) {
    return null;
  }

  return [...new Set(parsed as number[])];
}