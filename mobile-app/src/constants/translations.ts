// ---------------------------------------------------------------------------
// Translation placeholders — Sinhala-first UI planned for future release.
// Replace `en.*` calls with `useLanguage()` hook later.
// ---------------------------------------------------------------------------

type TranslationMap = Record<string, string>;

type LanguagePack = {
  name: string;
  translations: TranslationMap;
};

const english: LanguagePack = {
  name: "English",
  translations: {
    "home.title": "Win Big Today",
    "home.jackpot": "Today's Jackpot",
    "home.play_now": "Play Now",
    "home.sign_in_play": "Sign in to Play",
    "home.available_games": "Available Games",
    "home.see_all": "See All",
    "home.recent_winners": "Recent Winners",
    "game.entry": "Entry",
    "game.prize": "Prize",
    "game.players": "Players",
    "game.time_left": "Time Left",
    "game.play_now": "Play Now",
    "game.spots_left": "spots left",
    "game.full": "Full",
    "auth.enter_mobile": "Enter your mobile number",
    "auth.sign_in_message": "Sign in to play and win",
    "auth.send_otp": "Send OTP",
    "auth.verify_otp": "Verify OTP",
    "auth.code_sent": "Code sent to",
    "auth.demo_otp": "Demo OTP",
    "auth.change_number": "Change number",
    "auth.cancel": "Cancel",
    "auth.verifying": "Verifying...",
    "auth.invalid_phone": "Enter a valid Sri Lankan number.",
    "wallet.balance": "Your Balance",
    "wallet.deposit": "Deposit",
    "wallet.withdraw": "Withdraw",
    "wallet.transactions": "Transactions",
    "wallet.no_transactions": "No transactions yet",
    "wallet.empty_subtitle": "Your game and deposit history will appear here",
    "profile.title": "Profile",
    "profile.sign_out": "Sign Out",
    "profile.kyc_verification": "KYC Verification",
    "profile.edit_profile": "Edit Profile",
    "profile.sign_in_message": "Sign in to continue",
    "profile.sign_in_subtitle": "Sign in to track your games, manage your wallet, and view your profile.",
    "profile.sign_in": "Sign In",
    "profile.player": "Player",
    "profile.guest": "Guest",
    "profile.registered": "Registered",
    "profile.verified": "Verified Player",
    "profile.premium": "Premium",
    "error.network": "Unable to connect. Please try again.",
    "error.generic": "Something went wrong.",
    "loading": "Loading...",
    "lottery.title": "Today's Mahajana Sampatha",
    "lottery.draw_no": "Draw No",
    "lottery.date": "Date",
    "lottery.winning_number": "Winning Number",
    "lottery.tap_to_guess": "Tap to guess today's winning number",
  },
};

const sinhala: LanguagePack = {
  name: "සිංහල",
  translations: {
    // Placeholders — will be translated by a native speaker.
    "home.title": "අදම ජයගන්න",
    "home.jackpot": "අද ජැක්පොට්",
    "home.play_now": "දැන්ම ක්‍රීඩා කරන්න",
    "lottery.title": "අද දින ප්‍රතිඵලය",
    "lottery.draw_no": "වාර අංකය",
    "lottery.date": "දිනය",
    "lottery.winning_number": "ජයග්‍රාහී අංකය",
    "lottery.tap_to_guess": "අද අංකය අනුමාන කරන්න",
  },
};

const tamil: LanguagePack = {
  name: "தமிழ்",
  translations: {
    // Placeholders — will be translated by a native speaker.
    "home.title": "இன்றே வெல்லுங்கள்",
    "home.jackpot": "இன்றைய ஜாக்பாட்",
    "home.play_now": "இப்போது விளையாடுங்கள்",
  },
};

const DEFAULT_LANGUAGE = english;

export function getTranslation(key: string): string {
  return DEFAULT_LANGUAGE.translations[key] ?? key;
}

export const languages = { english, sinhala, tamil };