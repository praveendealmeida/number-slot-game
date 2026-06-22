export type PaymentResult = {
  success: boolean;
  reference: string | null;
  error?: string;
};

/**
 * Placeholder payment gateway integration.
 * Replace with Razorpay, Stripe, or your provider of choice.
 */
export async function processPaymentPlaceholder(input: {
  userId: string;
  gameId: string;
  amount: number;
  slotNumbers: number[];
}): Promise<PaymentResult> {
  void input;

  return {
    success: true,
    reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };
}
