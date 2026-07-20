import { prisma } from "@/lib/db";

/**
 * Centralised wallet service — every balance change flows through here
 * so we always have a complete audit trail.
 */

export async function creditWallet(
  walletId: string,
  userId: string,
  amount: number,           // positive integer in LKR cents
  type: string,
  description: string,
  referenceId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId,
        userId,
        type,
        amount,          // positive
        balanceAfter: wallet.balance,
        description,
        referenceId,
      },
    });

    return wallet;
  });
}

export async function debitWallet(
  walletId: string,
  userId: string,
  amount: number,           // positive integer in LKR cents
  type: string,
  description: string,
  referenceId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.balance < amount) {
      throw new Error("Insufficient balance.");
    }

    const updated = await tx.wallet.update({
      where: { id: walletId },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        walletId,
        userId,
        type,
        amount: -amount, // negative
        balanceAfter: updated.balance,
        description,
        referenceId,
      },
    });

    return updated;
  });
}

/**
 * Admin wallet adjustment — credits or debits a user's wallet,
 * creates a transaction of type ADMIN_ADJUSTMENT, and logs an AdminAction.
 */
export async function adminAdjustWallet(
  adminUserId: string,
  targetUserId: string,
  amount: number,           // positive = credit, negative = debit
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: targetUserId } });
    if (!wallet) throw new Error("User has no wallet.");

    if (amount < 0 && wallet.balance < Math.abs(amount)) {
      throw new Error("Insufficient balance for debit.");
    }

    const updated = amount >= 0
      ? await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        })
      : await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: Math.abs(amount) } },
        });

    // Transaction record
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        userId: targetUserId,
        type: "ADMIN_ADJUSTMENT",
        amount,
        balanceAfter: updated.balance,
        description: reason,
      },
    });

    // Audit log
    await tx.adminAction.create({
      data: {
        adminUserId,
        targetUserId,
        actionType: "WALLET_ADJUSTMENT",
        description: `${amount >= 0 ? "Credit" : "Debit"} Rs ${(Math.abs(amount) / 100).toFixed(0)}: ${reason}`,
        metadata: { amount, reason },
      },
    });

    return updated;
  });
}

/**
 * Log an admin action without wallet changes.
 */
export async function logAdminAction(
  adminUserId: string,
  actionType: string,
  description: string,
  targetUserId?: string,
  metadata?: Record<string, string | number | boolean | null>,
) {
  return prisma.adminAction.create({
    data: { adminUserId, actionType, targetUserId, description, metadata },
  });
}