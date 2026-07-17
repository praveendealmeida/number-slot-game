export function formatRs(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}