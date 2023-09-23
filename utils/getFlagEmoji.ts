/** Language to biggest country emoji map */
const languageToFlagMap: Record<string, string> = {
  "en": "🇺🇸", // english - united states
  "zh": "🇨🇳", // chinese - china
  "es": "🇪🇸", // spanish - spain
  "hi": "🇮🇳", // hindi - india
  "ar": "🇪🇬", // arabic - egypt
  "pt": "🇧🇷", // portuguese - brazil
  "bn": "🇧🇩", // bengali - bangladesh
  "ru": "🇷🇺", // russian - russia
  "ja": "🇯🇵", // japanese - japan
  "pa": "🇮🇳", // punjabi - india
  "de": "🇩🇪", // german - germany
  "ko": "🇰🇷", // korean - south korea
  "fr": "🇫🇷", // french - france
  "tr": "🇹🇷", // turkish - turkey
  "ur": "🇵🇰", // urdu - pakistan
  "it": "🇮🇹", // italian - italy
  "th": "🇹🇭", // thai - thailand
  "vi": "🇻🇳", // vietnamese - vietnam
  "pl": "🇵🇱", // polish - poland
  "uk": "🇺🇦", // ukrainian - ukraine
  "uz": "🇺🇿", // uzbek - uzbekistan
  "su": "🇮🇩", // sundanese - indonesia
  "sw": "🇹🇿", // swahili - tanzania
  "nl": "🇳🇱", // dutch - netherlands
  "fi": "🇫🇮", // finnish - finland
  "el": "🇬🇷", // greek - greece
  "da": "🇩🇰", // danish - denmark
  "cs": "🇨🇿", // czech - czech republic
  "sk": "🇸🇰", // slovak - slovakia
  "bg": "🇧🇬", // bulgarian - bulgaria
  "sv": "🇸🇪", // swedish - sweden
  "be": "🇧🇾", // belarusian - belarus
  "hu": "🇭🇺", // hungarian - hungary
  "lt": "🇱🇹", // lithuanian - lithuania
  "lv": "🇱🇻", // latvian - latvia
  "et": "🇪🇪", // estonian - estonia
  "sl": "🇸🇮", // slovenian - slovenia
  "hr": "🇭🇷", // croatian - croatia
  "zu": "🇿🇦", // zulu - south africa
  "id": "🇮🇩", // indonesian - indonesia
  "is": "🇮🇸", // icelandic - iceland
  "lb": "🇱🇺", // luxembourgish - luxembourg
};

export function getFlagEmoji(languageCode?: string): string | undefined {
  const language = languageCode?.split("-").pop()?.toLowerCase();
  if (!language) return;
  return languageToFlagMap[language];
}
