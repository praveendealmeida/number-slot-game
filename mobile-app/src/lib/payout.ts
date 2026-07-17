// Fixed platform payout policy — NOT configurable per game or by the admin UI.
// The winner always receives this share of the pool; the platform keeps the rest.
export const WINNER_PAYOUT_PERCENT = 70;
export const PLATFORM_FEE_PERCENT = 100 - WINNER_PAYOUT_PERCENT;