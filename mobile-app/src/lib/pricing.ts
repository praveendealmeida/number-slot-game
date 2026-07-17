// The 5 fixed ticket-price tiers the platform runs. Shared between the
// automated rotation job, the lobby, and the admin create-game form.
export const TICKET_PRICE_TIERS = [50, 100, 200, 500, 1000] as const;