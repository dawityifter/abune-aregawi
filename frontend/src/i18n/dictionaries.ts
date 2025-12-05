// Minimal bilingual dictionaries for English (en) and Tigrinya (ti).
// Keys align with the UI components we discussed (SiteHeader, Hero, QuickActions).

export type Lang = 'en' | 'ti';

export interface Dictionaries {
  common: {
    nav: {
      worship: string;
      events: string;
      give: string;
    };
    cta: {
      donate: string;
    };
  };
  // Keys used by Navigation.tsx
  navigation?: {
    dashboard: string;
  };
  sign?: {
    in: string;
    out: string;
  };
  auth?: {
    sign?: {
      up: string;
    };
  };
  language?: string;
  hero: {
    title: string;
    subtitle: string;
    cta: {
      give: string;
      times: string;
      watch: string;
      viewChannel: string;
    };
  };
  actions: {
    worship: { title: string; desc: string };
    events: { title: string; desc: string };
    give: { title: string; desc: string };
  };
  sections?: {
    announcements?: {
      title: string;
    };
  };
}

export const en: Dictionaries = {
  common: {
    nav: {
      worship: "Worship",
      events: "Events",
      give: "Give",
    },
    cta: {
      donate: "Donate",
    },
  },
  navigation: {
    dashboard: "Dashboard",
  },
  sign: {
    in: "Sign In",
    out: "Sign Out",
  },
  auth: {
    sign: {
      up: "Sign Up",
    },
  },
  language: "Language",
  hero: {
    title: "Welcome to Abune Aregawi Orthodox Tewahedo Church",
    subtitle: "Join us for worship, fellowship, and service. English & ትግርኛ",
    cta: {
      give: "Give Online",
      times: "Worship Times",
      watch: "Watch Live",
      viewChannel: "View Our Youtube Channel",
    },
  },
  actions: {
    worship: {
      title: "Worship",
      desc: "Service schedule & directions",
    },
    events: {
      title: "Events",
      desc: "Feast days & parish life",
    },
    give: {
      title: "Give",
      desc: "One-time or monthly giving",
    },
  },
  sections: {
    announcements: {
      title: "Community Announcements",
    },
  },
};

export const ti: Dictionaries = {
  common: {
    nav: {
      worship: "ስግደ",
      events: "ሓገዝታት",
      give: "ልገሳ",
    },
    cta: {
      donate: "ልገሳ",
    },
  },
  navigation: {
    dashboard: "ዳሽቦርድ",
  },
  sign: {
    in: "እተኻ",
    out: "ውጻእ",
  },
  auth: {
    sign: {
      up: "ኣኽትም",
    },
  },
  language: "ቋንቋ",
  hero: {
    // እንኳዕ ብደሓን መጻእኩም = “Welcome”
    // ቤ/ክ = ቤተ ክርስቲያን (shorthand)
    title:
      "እንኳዕ ብደሓን መጻእኩም ናብ ቤ/ክ ኣቡነ ኣረጋዊ ኦርቶዶክስ ተዋህዶ",
    // “Worship, fellowship & service — English & Tigrinya”
    subtitle:
      "ስግደ፣ ሕብረትን ግብሪን — ብ እንግሊዝኛን ትግርኛን",
    cta: {
      give: "ልገሳ ኣንታዊ",
      times: "ሰዓታት ስግደ",
      watch: "ቀጥታ ርእይ",
      viewChannel: "ቻነል ዩቲዩብና ርኣይ",
    },
  },
  actions: {
    worship: {
      title: "ስግደ",
      desc: "ሰዓታት ስግደን መመሪያ መንገዲን",
    },
    events: {
      title: "ሓገዝታት",
      desc: "በዓላትን ሕይወት ቤተ ክርስቲያንን",
    },
    give: {
      title: "ልገሳ",
      desc: "ሓደ ጊዜ ወይ ወርሓዊ ልገሳ",
    },
  },
  sections: {
    announcements: {
      title: "ማሕበራዊ ሓበሬታታት",
    },
  },
};

// Convenience export for provider lookup
export const dictionaries: Record<Lang, Dictionaries> = { en, ti };