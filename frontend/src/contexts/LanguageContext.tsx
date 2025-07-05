import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ti';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translations object
const translations = {
  en: {
    // Hero Section
    'church.name': 'Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church',
    'welcome.headline': 'Welcome to Our Spiritual Home',
    'welcome.subtitle': 'Welcome to Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church',
    
    // Service Times
    'service.times': 'Service Times',
    'sunday': 'Sunday',
    'wednesday': 'Wednesday',
    'friday': 'Friday',
    'location': 'Location',
    'get.directions': 'Get Directions',
    
    // CTA Buttons
    'plan.visit': 'Plan a Visit',
    'watch.live': 'Watch Live',
    'register.member': 'Register Member',
    'view.dues': 'View Dues / Login',
    
    // Section Headers
    'whats.happening': "What's Happening",
    'watch.listen': 'Watch or Listen',
    'participation': 'Participation Made Easy',
    'stay.connected': 'Stay Connected',
    'newcomer': 'New to Our Church?',
    'grow.spiritually': 'Grow Spiritually',
    
    // Participation Cards
    'volunteer': 'Volunteer',
    'volunteer.desc': 'Join our ministry teams and serve our community',
    'volunteer.sign.up': 'Sign Up',
    'give.online.desc': 'Support our church with secure online giving',
    'donate': 'Donate',
    'member.portal': 'Member Portal',
    'member.portal.desc': 'Access your dues and member information',
    'member.login': 'Login',
    
    // Media Links
    'watch.live.stream': 'Watch Live Stream',
    'sermon.archive': 'Sermon Archive',
    'join.zoom.prayer': 'Join Zoom Prayer',
    
    // Auth
    'sign.in': 'Sign In',
    'sign.in.subtitle': 'Sign in to your account',
    'auth.sign.up': 'Sign Up',
    'sign.out': 'Sign Out',
    'email': 'Email',
    'email.placeholder': 'Enter your email',
    'password': 'Password',
    'password.placeholder': 'Enter your password',
    'confirm.password': 'Confirm Password',
    'forgot.password': 'Forgot Password?',
    'remember.me': 'Remember me',
    'signing.in': 'Signing in...',
    'no.account': "Don't have an account?",
    'back.to.login': 'Back to Login',
    'send.reset.email': 'Send Reset Email',
    'sending': 'Sending...',
    
    // Dashboard
    'member.dashboard': 'Member Dashboard',
    'welcome': 'Welcome',
    'profile': 'Profile',
    'view.profile': 'View Profile',
    'view.and.pay': 'View and pay your dues',
    'upcoming.events': 'Upcoming events',
    'view.events': 'View Events',
    'serve.community': 'Serve our community',
    'support.church': 'Support our church',
    'settings': 'Settings',
    'account.settings': 'Account settings',
    'manage.account': 'Manage Account',
    
    // Profile
    'edit.profile': 'Edit Profile',
    'profile.information': 'Profile Information',
    'basic.information': 'Basic Information',
    'full.name': 'Full Name',
    'role': 'Role',
    'member.since': 'Member Since',
    'phone.number': 'Phone Number',
    'date.of.birth': 'Date of Birth',
    'gender': 'Gender',
    'church.information': 'Church Information',
    'spiritual.father': 'Spiritual Father',
    'name.day': 'Name Day',
    'liturgical.role': 'Liturgical Role',
    'language.preference': 'Language Preference',
    'emergency.contact': 'Emergency Contact',
    'emergency.phone': 'Emergency Phone',
    'edit': 'Edit',
    'cancel': 'Cancel',
    'save': 'Save',
    'saving': 'Saving...',
    'not.provided': 'Not provided',
    'select.gender': 'Select gender',
    'male': 'Male',
    'female': 'Female',
    'other': 'Other',
    'none': 'None',
    'reader': 'Reader',
    'deacon': 'Deacon',
    'priest': 'Priest',
    'choir.member': 'Choir Member',
    'sunday.school.teacher': 'Sunday School Teacher',
    'emergency.contact.name': 'Emergency contact name',
    'emergency.phone.number': 'Emergency phone number',
    'marital.status': 'Marital Status',
    'select.marital.status': 'Select marital status',
    'single': 'Single',
    'married': 'Married',
    'divorced': 'Divorced',
    'widowed': 'Widowed',
    'address': 'Address',
    'date.joined.parish': 'Date Joined Parish',
    'baptism.name': 'Baptism Name',
    'baptism.name.placeholder': 'Enter your baptism name',
    'baptism.status': 'Baptism Status',
    'baptized': 'Baptized',
    'not.baptized': 'Not Baptized',
    'chrismation.status': 'Chrismation Status',
    'chrismated': 'Chrismated',
    'not.chrismated': 'Not Chrismated',
    'communicant.member': 'Communicant Member',
    'yes': 'Yes',
    'no': 'No',
    'street.line1': 'Street Address',
    'apartment.no': 'Apartment No. (optional)',
    'city': 'City',
    'state': 'State',
    'zip.code': 'Zip Code',
    'interested.in.serving': 'Interested in Serving',
    'select.option': 'Select option',
  },
  ti: {
    // Hero Section
    'church.name': 'ደብረ ጸሓይ አቡነ አረጋዊ ትግራይ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን',
    'welcome.headline': 'ናብ መንበረ ስፍሓትና ብደሓን መጻእኩም',
    'welcome.subtitle': 'እንኳዕ ናብ ቤተ ክርስትያን ኦርቶዶክስ ትግራይ ኣቡነ ኣረጋዊ ብደሓን መጻእኩም!',
    
    // Service Times
    'service.times': 'ግዜ ኣገልግሎት',
    'sunday': 'ሰንበት',
    'wednesday': 'ረቡዕ',
    'friday': 'ዓርቢ',
    'location': 'ኩነታት',
    'get.directions': 'ኣዛምድ',
    
    // CTA Buttons
    'plan.visit': 'ምብጻሕ ኣዘዝምድ',
    'watch.live': 'ብቀጥታ ርኣይ',
    'register.member': 'ደምድም ኣኽትም',
    'view.dues': 'ክፍሊት ርኣይ / እተኻ',
    
    // Section Headers
    'whats.happening': 'ምን እዩ ዘጋጥም',
    'watch.listen': 'ርኣይ ወይ ሰምዕ',
    'participation': 'ክፍሊት ቀሊል እዩ',
    'stay.connected': 'ተራኺልካ ክትነብር',
    'newcomer': 'ሓድሽ እኹም ኣብ ቤተ ክርስቲያንና?',
    'grow.spiritually': 'ብመንፈስ ክትሰፍሕ',
    
    // Participation Cards
    'volunteer': 'ተጋሩ',
    'volunteer.desc': 'ኣብ ጕጅለ ኣገልግሎትና ተጸምብር እሞ ንማሕበረሰብና ኣገልግል',
    'volunteer.sign.up': 'ኣኽትም',
    'give.online.desc': 'ቤተ ክርስቲያንና ብድሕሪት ሃብ ሓጋዚ እዩ',
    'donate': 'ሃብ',
    'member.portal': 'ደገ ኣባል',
    'member.portal.desc': 'ክፍሊትካን ሓበሬታ ኣባልካን ኣብርር',
    'member.login': 'እተኻ',
    
    // Media Links
    'watch.live.stream': 'ብቀጥታ ርኣይ',
    'sermon.archive': 'ናይ ስብከት መዝገብ',
    'join.zoom.prayer': 'ብዙም ጸሎት ተጸምብር',
    
    // Auth
    'sign.in': 'እተኻ',
    'sign.in.subtitle': 'ናብ ኣካውንትካ እተኻ',
    'auth.sign.up': 'ኣኽትም',
    'sign.out': 'ውጻእ',
    'email': 'ኢመይል',
    'email.placeholder': 'ኢመይልካ ኣእትው',
    'password': 'መሕለፊ ቃል',
    'password.placeholder': 'መሕለፊ ቃልካ ኣእትው',
    'confirm.password': 'መሕለፊ ቃል ኣረጋግጽ',
    'forgot.password': 'መሕለፊ ቃል ረሲዕካ?',
    'remember.me': 'ኣዘኻኽረኒ',
    'signing.in': 'እተኻ እየ...',
    'no.account': 'ኣካውንት የብልካን?',
    'back.to.login': 'ናብ እተኻ ተመለስ',
    'send.reset.email': 'ኢመይል ምልኣኽ ልእኽ',
    'sending': 'እየ ልእኽ...',
    
    // Dashboard
    'member.dashboard': 'ደገ ኣባላት',
    'welcome': 'እንቋዕ ብደሓን መጻእኩም',
    'profile': 'ፕሮፋይል',
    'view.profile': 'ፕሮፋይል ርኣይ',
    'view.and.pay': 'ክፍሊትካ ርኣይ እሞ ኣኽፈል',
    'upcoming.events': 'ዝመጽእ ነገራት',
    'view.events': 'ነገራት ርኣይ',
    'serve.community': 'ንማሕበረሰብና ኣገልግል',
    'support.church': 'ቤተ ክርስቲያንና ሓጋዚ እዩ',
    'settings': 'ቅንጡፍቲ',
    'account.settings': 'ቅንጡፍቲ ኣካውንት',
    'manage.account': 'ኣካውንት ምምሕዳር',
    
    // Profile
    'edit.profile': 'ፕሮፋይል ኣምልስ',
    'profile.information': 'ሓበሬታ ፕሮፋይል',
    'basic.information': 'ቀንዲ ሓበሬታታት',
    'full.name': 'ምሉእ ስም',
    'role': 'ሓላፍነት',
    'member.since': 'ካብ መዓስ ኣባል',
    'phone.number': 'ቁጽሪ ስልኪ',
    'date.of.birth': 'ዕለተ ልደት',
    'gender': 'ፆታ',
    'church.information': 'ሓበሬታ ቤተ ክርስቲያን',
    'spiritual.father': 'ኣቡነ መንፈስ',
    'name.day': 'ዕለተ ስም',
    'liturgical.role': 'ሓላፍነት ስነ ቅልስ',
    'language.preference': 'ቋንቋ ተሻጋሪ',
    'emergency.contact': 'ተራኺል ሓጋዚ',
    'emergency.phone': 'ስልኪ ሓጋዚ',
    'edit': 'ኣምልስ',
    'cancel': 'ሰርዝ',
    'save': 'ኣቐምጥ',
    'saving': 'እየ ኣቐምጥ...',
    'not.provided': 'ዘይተሃበ',
    'select.gender': 'ፆታ ምረጽ',
    'male': 'ወዲ',
    'female': 'ሰበይቲ',
    'other': 'ካልእ',
    'none': 'ሓንቲ',
    'reader': 'ኣንቀጸባር',
    'deacon': 'ዲያቆን',
    'priest': 'ቀሺ',
    'choir.member': 'ኣባል መደምደምታ',
    'sunday.school.teacher': 'ምሁር ትምህርቲ ሰንበት',
    'emergency.contact.name': 'ስም ተራኺል ሓጋዚ',
    'emergency.phone.number': 'ቁጽሪ ስልኪ ሓጋዚ',
    'marital.status': 'ዕርድ',
    'select.marital.status': 'ዕርድ ምረጽ',
    'single': 'ሓንቲ',
    'married': 'ዝተመርዓለት',
    'divorced': 'ዝተፈልየት',
    'widowed': 'ዝተረስዐት',
    'address': 'ኩነታት',
    'date.joined.parish': 'ዕለተ መዓስ ቤተ ክርስቲያን',
    'baptism.name': 'ስም ዕርድ',
    'baptism.name.placeholder': 'ስም ዕርድካ ኣእትው',
    'baptism.status': 'ዕርድ ምጥምታ',
    'baptized': 'ዝተጠምተ',
    'not.baptized': 'ዘይተጠምተ',
    'chrismation.status': 'ዕርድ ምስባር',
    'chrismated': 'ዝተሰበረ',
    'not.chrismated': 'ዘይተሰበረ',
    'communicant.member': 'ኣባል ተሳታፊ',
    'yes': 'እወ',
    'no': 'ኣይኮነን',
    'street.line1': 'ደብቲ መንገዲ',
    'apartment.no': 'ቤት ቁጽሪ (ኣማራጺ)',
    'city': 'ከተማ',
    'state': 'ግዛት',
    'zip.code': 'ዚፕ ኮድ',
    'interested.in.serving': 'ኣብ ኣገልግሎት ተሻጋሪ',
    'select.option': 'ምረጽ',
  }
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('preferredLanguage');
    return (saved as Language) || 'ti'; // Default to Tigrigna
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 