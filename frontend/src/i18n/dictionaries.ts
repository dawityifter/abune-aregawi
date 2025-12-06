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
      learnMore: string;
      readMore: string;
      getDetails: string;
      contact: string;
      latestTeaching: string;
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
    mission: string;
  };
  actions: {
    worship: { title: string; desc: string };
    events: { title: string; desc: string };
    give: { title: string; desc: string };
  };
  sections?: {
    announcements?: {
      title: string;
      community: { title: string; desc: string };
      teachings: { title: string; desc: string };
      culture: { title: string; desc: string };
    };
  };
  quicklinks: {
    priest: string;
    serviceTimes: string;
    location: string;
    getDirections: string;
  };
  nav: {
    makePledge: string;
  };
  dashboard: {
    welcome: string;
    settingUp: string;
    complete: string;
    retry: string;
    incomplete: { title: string; desc: string };
    profile: { title: string; view: string };
    bylaw: { title: string; desc: string; view: string };
    dues: { title: string; viewAndPay: string; dependentView: string; view: string };
    events: { title: string; upcoming: string; view: string };
    service: { title: string; desc: string; view: string };
    give: { title: string; desc: string; action: string };
    family: { title: string; desc: string; manage: string };
    communications: { title: string; desc: string; open: string };
    relationships: { title: string; desc: string; open: string };
    treasurer: { title: string; desc: string; view: string };
    admin: { title: string; desc: string; access: string };
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
      learnMore: "Learn More",
      readMore: "Read More",
      getDetails: "Get Details",
      contact: "Contact",
      latestTeaching: "Latest Teaching",
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
    mission: "We want everyone, everywhere to have an everyday relationship with the lord. By uniting through the Eucharist.",
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
      community: {
        title: "Community Support Initiatives",
        desc: "Join us in supporting our community through outreach and charity programs."
      },
      teachings: {
        title: "Tigray Orthodox Faith Teachings",
        desc: "Explore the rich traditions and teachings of the Tigray Orthodox faith."
      },
      culture: {
        title: "Cultural Celebrations",
        desc: "Experience our heritage through festivals and community gatherings."
      }
    },
  },
  quicklinks: {
    priest: "Priest",
    serviceTimes: "Service Times",
    location: "Location",
    getDirections: "Get Directions",
  },
  nav: {
    makePledge: "Make a Pledge",
  },
  dashboard: {
    welcome: "Welcome!",
    settingUp: "We're setting up your account. This will just take a moment...",
    complete: "Complete Registration",
    retry: "Retry",
    incomplete: {
      title: "Profile Incomplete",
      desc: "Please complete your registration to access the dashboard."
    },
    profile: {
      title: "Profile",
      view: "View Profile"
    },
    bylaw: {
      title: "Church Bylaw",
      desc: "View church bylaws (EN/ትግ)",
      view: "View Bylaw"
    },
    dues: {
      title: "Dues",
      viewAndPay: "View and Pay",
      dependentView: "View Dues/Login",
      view: "View Dues"
    },
    events: {
      title: "Events",
      upcoming: "Upcoming events",
      view: "View Events"
    },
    service: {
      title: "My Service",
      desc: "Department & Volunteer Work",
      view: "View Departments"
    },
    give: {
      title: "Give",
      desc: "Support the church",
      action: "Donate"
    },
    family: {
      title: "Children & Dependents",
      desc: "Manage family members",
      manage: "Manage Children"
    },
    communications: {
      title: "Communications",
      desc: "Send SMS to members and groups",
      open: "Open SMS"
    },
    relationships: {
      title: "Relationship Department",
      desc: "Outreach, onboarding, and engagement tools",
      open: "Open Relationship Dashboard"
    },
    treasurer: {
      title: "Treasurer",
      desc: "Manage member payments and financial records",
      view: "View Payments"
    },
    admin: {
      title: "Admin Panel",
      desc: "Manage members and roles",
      access: "Access Admin Panel"
    }
  }
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
      learnMore: "ተወሳኺ ሓበሬታ",
      readMore: "ዝርዝር ኣንብብ",
      getDetails: "ዝርዝር ርኣይ",
      contact: "ርክብ",
      latestTeaching: "ሓዱሽ ትምህርቲ",
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
    mission: "ንሕና ኩሉ ሰብ፣ ኣብ ኩሉ ቦታ፣ ምስ ጎይታ መዓልታዊ ርክብ ክህልዎ ንደሊ። ብቅዱስ ቁርባን ብምሕባር።",
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
      community: {
        title: "ተበግሶታት ደገፍ ማሕበረሰብ",
        desc: "ንማሕበረሰብና ብምሕጋዝን ግብረ-ሰናይ ፕሮግራማትን ደገፍኩም ኣርእዩ።"
      },
      teachings: {
        title: "ትምህርቲ ሃይማኖት ኦርቶዶክስ ትግራይ",
        desc: "ሃብታም ባህልን ትምህርትን እምነት ኦርቶዶክስ ትግራይ ዳህስሱ።"
      },
      culture: {
        title: "ባህላዊ በዓላት",
        desc: "ባህልናን ውርስናን ብበዓላትን ማሕበራዊ ምትእኽኻብን ኣስተማቕሩ።"
      }
    },
  },
  quicklinks: {
    priest: "ካህን",
    serviceTimes: "ሰዓታት ስግደ",
    location: "ቦታ",
    getDirections: "መንገዲ ርኣይ",
  },
  nav: {
    makePledge: "መብጽዓ ምእታው",
  },
  dashboard: {
    welcome: "እንኳዕ ብደሓን መጻእኩም!",
    settingUp: "ኣካውንትኩም ነዳሉ ኣለና። እዚ ቁሩብ ግዜ ክወስድ እዩ...",
    complete: "ምዝገባ ወድእ",
    retry: "ደጊምካ ፈትን",
    incomplete: {
      title: "ፕሮፋይል ኣይተወድአን",
      desc: "ዳሽቦርድ ንምርኣይ በይዘኦም ምዝገባ ይወድኡ።"
    },
    profile: {
      title: "ፕሮፋይል",
      view: "ፕሮፋይል ርኣይ"
    },
    bylaw: {
      title: "ሕጊ ቤተ ክርስቲያን",
      desc: "ሕጊ ቤተ ክርስቲያን (EN/ትግ)",
      view: "ሕጊ ርኣይ"
    },
    dues: {
      title: "ወርሓዊ ክፍሊት",
      viewAndPay: "ርኣይን ክፈልን",
      dependentView: "ርኣይ/እተኻ",
      view: "ክፍሊት ርኣይ"
    },
    events: {
      title: "መረሃ ግብሪ",
      upcoming: "ዝመጽእ መረሃ ግብሪ",
      view: "መረሃ ግብሪ ርኣይ"
    },
    service: {
      title: "ኣገልግሎተይ",
      desc: "ክፍሊ ስራሕን ወለንታን",
      view: "ክፍሊ ስራሕ ርኣይ"
    },
    give: {
      title: "ልገሳ",
      desc: "ቤተ ክርስቲያን ደግፍ",
      action: "ልገሳ"
    },
    family: {
      title: "ደቀይ/ቤተሰበይ",
      desc: "ቤተሰብ ምምሕዳር",
      manage: "ደቀይ ምምሕዳር"
    },
    communications: {
      title: "ርክባት",
      desc: "መልእኽቲ/SMS ስደድ",
      open: "ኤስ.ኤም.ኤስ ክፈት"
    },
    relationships: {
      title: "ክፍሊ ርክባት",
      desc: "ተበግሶን ተሳትፎን መሳርሒ",
      open: "ዳሽቦርድ ርክባት ክፈት"
    },
    treasurer: {
      title: "ተሓዝ ገንዘብ",
      desc: "ፋይናንስን ክፍሊትን ምምሕዳር",
      view: "ክፍሊት ርኣይ"
    },
    admin: {
      title: "መማሓደሪ",
      desc: "ኣባላትን ግደታትን ምምሕዳር",
      access: "ናብ መማሓደሪ እጠው"
    }
  }
};

// Convenience export for provider lookup
export const dictionaries: Record<Lang, Dictionaries> = { en, ti };