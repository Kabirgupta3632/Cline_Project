// Tiny client-side i18n dictionary for the donor notifications page copy
// (English / Hindi / Assamese) - no full i18n library given the hackathon
// time budget, just a plain object keyed by language code. Feature: Donor UI
// (Person 3).
"use client";

export type Lang = "en" | "hi" | "as";

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी",
  as: "অসমীয়া",
};

export const DONOR_STRINGS: Record<
  Lang,
  {
    subtitle: string;
    profile: string;
    switchRole: string;
    loadError: string;
    noPending: string;
    unitsNeeded: string;
    away: string;
    yes: string;
    no: string;
    snoozeTitle: string;
    snoozeSubtitle: string;
    enableAlerts: string;
    alertsEnabled: string;
  }
> = {
  en: {
    subtitle: "RakshaRakt Notifications",
    profile: "Profile",
    switchRole: "Switch",
    loadError: "Couldn't load notifications yet",
    noPending:
      "No pending requests right now. We'll alert you the moment a nearby hospital needs your blood group. 🙏",
    unitsNeeded: "unit(s) needed",
    away: "away",
    yes: "✅ Yes, I can donate",
    no: "❌ Not now",
    snoozeTitle: "Snooze notifications",
    snoozeSubtitle: "We won't notify you again until:",
    enableAlerts: "🔔 Enable Alerts",
    alertsEnabled: "🔔 Alerts on",
  },
  hi: {
    subtitle: "रक्षारक्त सूचनाएं",
    profile: "प्रोफाइल",
    switchRole: "बदलें",
    loadError: "सूचनाएं अभी लोड नहीं हो सकीं",
    noPending:
      "अभी कोई अनुरोध लंबित नहीं है। जैसे ही किसी नज़दीकी अस्पताल को आपके ब्लड ग्रुप की ज़रूरत होगी, हम आपको सूचित करेंगे। 🙏",
    unitsNeeded: "यूनिट चाहिए",
    away: "दूर",
    yes: "✅ हाँ, मैं रक्तदान कर सकता/सकती हूँ",
    no: "❌ अभी नहीं",
    snoozeTitle: "सूचनाएं स्नूज़ करें",
    snoozeSubtitle: "हम आपको तब तक सूचित नहीं करेंगे:",
    enableAlerts: "🔔 अलर्ट चालू करें",
    alertsEnabled: "🔔 अलर्ट चालू है",
  },
  as: {
    subtitle: "ৰক্ষাৰক্ত জাননী",
    profile: "প্ৰ'ফাইল",
    switchRole: "সলনি কৰক",
    loadError: "জাননী এতিয়াও ল'ড হ'ব পৰা নাই",
    noPending:
      "এতিয়া কোনো অনুৰোধ বাকী নাই। ওচৰৰ হাস্পতাললৈ আপোনাৰ ৰক্তৰ গোটৰ প্ৰয়োজন হ'লেই আমি আপোনাক জনাম। 🙏",
    unitsNeeded: "ইউনিট দৰকাৰ",
    away: "দূৰত",
    yes: "✅ হয়, মই ৰক্তদান কৰিব পাৰোঁ",
    no: "❌ এতিয়া নহয়",
    snoozeTitle: "জাননী স্নুজ কৰক",
    snoozeSubtitle: "আমি আপোনাক আকৌ নজনোৱালৈকে:",
    enableAlerts: "🔔 এলাৰ্ট অন কৰক",
    alertsEnabled: "🔔 এলাৰ্ট অন আছে",
  },
};

const STORAGE_KEY = "raksharakt_donor_lang";

export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "hi" || v === "as" ? v : "en";
}

export function setStoredLang(lang: Lang): void {
  window.localStorage.setItem(STORAGE_KEY, lang);
}
