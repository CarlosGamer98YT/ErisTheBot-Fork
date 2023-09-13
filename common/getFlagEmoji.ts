/** Language to biggest country emoji map */
const languageToFlagMap: Record<string, string> = {
  "en": "🇺🇸",
  "zh": "🇨🇳",
  "es": "🇪🇸",
  "hi": "🇮🇳",
  "ar": "🇪🇬",
  "pt": "🇧🇷",
  "bn": "🇧🇩",
  "ru": "🇷🇺",
  "ja": "🇯🇵",
  "pa": "🇮🇳",
  "de": "🇩🇪",
  "ko": "🇰🇷",
  "fr": "🇫🇷",
  "tr": "🇹🇷",
  "ur": "🇵🇰",
  "it": "🇮🇹",
  "th": "🇹🇭",
  "vi": "🇻🇳",
  "pl": "🇵🇱",
  "uk": "🇺🇦",
  "uz": "🇺🇿",
  "su": "🇮🇩",
  "sw": "🇹🇿",
  "nl": "🇳🇱",
  "fi": "🇫🇮",
  "el": "🇬🇷",
  "da": "🇩🇰",
  "cs": "🇨🇿",
  "sk": "🇸🇰",
  "bg": "🇧🇬",
  "sv": "🇸🇪",
  "be": "🇧🇾",
  "hu": "🇭🇺",
  "lt": "🇱🇹",
  "lv": "🇱🇻",
  "et": "🇪🇪",
  "sl": "🇸🇮",
  "hr": "🇭🇷",
  "zu": "🇿🇦",
  "id": "🇮🇩",
  "is": "🇮🇸",
  "lb": "🇱🇺", // Luxembourgish - Luxembourg
};

export function getFlagEmoji(languageCode?: string): string | undefined {
  const language = languageCode?.split("-").pop()?.toLowerCase();
  if (!language) return;
  return languageToFlagMap[language];
}
