import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ti';

interface LanguageContextType {
  language: Language;
  currentLanguage: Language; // Alias for language for better compatibility
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
    'church.bylaw': 'Church Bylaw',
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
    
    // Admin Panel
    'admin.panel': 'Admin Panel',
    'admin.dashboard': 'Admin Dashboard',
    'manage.members': 'Manage Members',
    'manage.members.and.roles': 'Manage members and roles',
    'access.admin.panel': 'Access Admin Panel',
    'role.management': 'Role Management',
    'manage.member.roles.and.permissions': 'Manage member roles and permissions',
    'update.member.roles': 'Update Member Roles',
    'change.role': 'Change Role',
    'new.role': 'New Role',
    'current.role': 'Current Role',
    'role.descriptions': 'Role Descriptions',
    'update.role': 'Update Role',
    'updating.role.for': 'Updating role for',
    'new.permissions': 'New Permissions',
    'updating': 'Updating...',
    'statistics': 'Statistics',
    'overview.of.church.membership': 'Overview of church membership',
    'total.members': 'Total Members',
    'active.members': 'Active Members',
    'total.children': 'Total Children',
    'recent.registrations': 'Recent Registrations',
    'role.breakdown': 'Role Breakdown',
    'gender.breakdown': 'Gender Breakdown',
    'marital.status.breakdown': 'Marital Status Breakdown',
    'language.preference.breakdown': 'Language Preference Breakdown',
    'membership.status': 'Membership Status',
    'members.with.children': 'Members with Children',
    'activity.metrics': 'Activity Metrics',
    'new.registrations.30.days': 'New Registrations (30 days)',
    'avg.children.per.family': 'Avg Children per Family',
    'active.rate': 'Active Rate',
    'quick.actions': 'Quick Actions',
    'export.member.list': 'Export Member List',
    'generate.report': 'Generate Report',
    'send.communication': 'Send Communication',
    'refresh.statistics': 'Refresh Statistics',
    'no.data.available': 'No data available',
    'edit.member': 'Edit Member',
    'search': 'Search',
    'search.members': 'Search members',
    'all.roles': 'All Roles',
    'all.statuses': 'All Statuses',
    'active': 'Active',
    'inactive': 'Inactive',
    'actions': 'Actions',
    'joined': 'Joined',
    'children': 'Children',
    'name': 'Name',
    'current.permissions': 'Current Permissions',
    'confirm.delete.member': 'Are you sure you want to delete this member?',
    'no.permission.to.edit': 'You do not have permission to edit members',
    'basic.info': 'Basic Information',
    'contact.info': 'Contact Information',
    'spiritual.info': 'Spiritual Information',
    'family.info': 'Family Information',
    'emergency.contact.name': 'Emergency Contact Name',
    'emergency.contact.phone': 'Emergency Contact Phone',
    'street.address': 'Street Address',
    'postal.code': 'Postal Code',
    'country': 'Country',
    'spouse.name': 'Spouse Name',
    'spouse.email': 'Spouse Email',
    'interested.in.serving': 'Interested in Serving',
    'tithe.participation': 'Tithe Participation',
    'ministries': 'Ministries',
    'ministries.placeholder': 'List ministries you are interested in...',
    'preferred.giving.method': 'Preferred Giving Method',
    'select.giving.method': 'Select giving method',
    'cash': 'Cash',
    'check': 'Check',
    'online': 'Online',
    'bank_transfer': 'Bank Transfer',
    'select.language': 'Select language',
    'english': 'English',
    'tigrinya': 'Tigrinya',
    'amharic': 'Amharic',
    'no.children.registered': 'No children registered',
    'save.changes': 'Save Changes',
    
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
    'select.option': 'Select option',
    
    // Children and Dependents Section
    'children.and.dependents': 'Children & Dependents',
    
    // Member Status
    'member.status': 'Member Status',
    'search.placeholder': 'Search by name or phone...',
    'sort.by': 'Sort By',
    'order': 'Order',
    'ascending': 'Ascending',
    'descending': 'Descending',
    'phone': 'Phone',
    'monthly.payment': 'Monthly Payment',
    'total.due': 'Total Due',
    'collected': 'Collected',
    'balance': 'Balance',
    'status': 'Status',
    'paid.up.to': 'Paid Up To',
    'household': 'Household',
    'paid.up': 'Paid Up',
    'partial': 'Partial',
    'outstanding': 'Outstanding',
    'no.members.found': 'No members found',
    'try.adjusting.search': 'Try adjusting your search terms',
    'showing': 'Showing',
    'to': 'to',
    'of': 'of',
    'members': 'members',
    'previous': 'Previous',
    'next': 'Next',
    
    // Registration Form
    'title': 'Member Registration',
    'personalInfo': 'Personal Information',
    'contactAddress': 'Contact & Address',
    'familyInfo': 'Family Information',
    'spiritualInfo': 'Spiritual Information',
    'contributionInfo': 'Contribution Information',
    'accountInfo': 'Account Information',
    'submit': 'Submit Registration',
    'required': 'Required',
    'optional': 'Optional',
    
    // Form Fields
    'first.name': 'First Name',
    'middle.name': 'Middle Name',
    'last.name': 'Last Name',
    'first.name.required': 'First name is required',
    'last.name.required': 'Last name is required',
    'date.of.birth.required': 'Date of birth is required',
    'phone.number.required': 'Phone number is required',
    'email.required': 'Email is required',
    'street.line1.required': 'Street address is required',
    'city.required': 'City is required',
    'state.required': 'State is required',
    'postal.code.required': 'Postal code is required',
    'country.required': 'Country is required',
    'login.email.required': 'Login email is required',
    'password.required': 'Password is required',
    'passwords.dont.match': 'Passwords do not match',
    'password.too.short': 'Password must be at least 8 characters long',
    
    // Additional Form Fields
    'email.address': 'Email Address',
    'apartment.suite.number': 'Apartment/Suite Number',
    'state.province': 'State/Province',
    'spouse.contact.phone': 'Spouse Contact Phone',
    'login.email': 'Login Email',
    
    // Head of Household
    'head.of.household': 'Are you the head of your household?',
    'head.of.household.help': 'If your spouse has not registered yet, please select Yes to register as the head of household. Only the head of household should add children/dependents.',
    'head.of.household.email': 'Head of Household Email',
    'head.of.household.email.help': 'Enter the email address of the existing head of household member. If this email is not found, you must register as head of household.',
    'head.of.household.email.not.found': 'No member found with this email address. Please register as head of household or provide a valid head of household email.',
    'has.dependents': 'I have children or dependents to register',
    'has.dependents.help': 'Check this box if you want to add children or dependents during registration. You can also add them later from your dashboard.',
    
    // Processing
    'processing': 'Processing...',
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
    'church.bylaw': 'ሕጊ ቤተ ክርስቲያን',
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
    'emergency.phone.number': 'ቁጽሪ ስልኪ ሓጋዚ',
    'address': 'ኩነታት',
    'date.joined.parish': 'ዕለተ መዓስ ቤተ ክርስቲያን',
    'baptism.name.placeholder': 'ስም ዕርድካ ኣእትው',
    'baptism.status': 'ዕርድ ምጥምታ',
    'not.baptized': 'ዘይተጠምተ',
    'chrismation.status': 'ዕርድ ምስባር',
    'chrismated': 'ዝተሰበረ',
    'not.chrismated': 'ዘይተሰበረ',
    'communicant.member': 'ኣባል ተሳታፊ',
    'street.line1': 'ደብቲ መንገዲ',
    'apartment.no': 'ቤት ቁጽሪ (ኣማራጺ)',
    'zip.code': 'ዚፕ ኮድ',
    'select.option': 'ምረጽ ኣምረጽ',
    
    // Children/Dependents
    'children.dependents': 'ውልዲ እንተሃልዩ ተራኺል',
    'children.dependents.help': 'ውልዲ ወይ ተራኺል እቶም ምስ ቤተሰብካ ክውስኽ ዘለዎም ኣኽትም።',
    'add.new.child': 'ሓድሽ ውልዲ ኣኽትም',
    'add.child': 'ውልዲ ኣኽትም',
    'added.children': 'ዝተኣከቡ ውልዲ',
    'born': 'ዝተወለደ',
    'is.baptized': 'ዕርድ ዝተጠምተ ዲኦ?',
    'remove': 'ሰርዝ',
    'no.children.added': 'ገና ውልዲ ኣይተኣከቡን።',
    'add.children.now': 'ሕጂ ውልዲ ኣኽትም ወይ ድሕሪ ካብ ዳሽቦርድካ ኣኽትም።',
    
    // Member Status
    'member.status': 'ሓበሬታ ኣባላት',
    'search.placeholder': 'ብስም ወይ ብስልኪ ድለ...',
    'sort.by': 'ብዝኾነ ምስደርደር',
    'order': 'ቅደም ምስደርደር',
    'ascending': 'ካብ ታሕቲ ናብ ላዕሊ',
    'descending': 'ካብ ላዕሊ ናብ ታሕቲ',
    'phone': 'ስልኪ',
    'monthly.payment': 'ወርሓዊ ክፍሊት',
    'total.due': 'ጠቕላላ ክፍሊት',
    'collected': 'ዝተኣከበ',
    'balance': 'ሂሳብ',
    'status': 'ሓበሬታ',
    'paid.up.to': 'ዝተኸፈለ ክሳብ',
    'household': 'ቤተሰብ',
    'paid.up': 'ዝተኸፈለ',
    'partial': 'ከፊል',
    'outstanding': 'ዘይተኸፈለ',
    'no.members.found': 'ኣባላት ኣይተረኽበን',
    'try.adjusting.search': 'ድለካ ኣምልስ እሞ ዳግማይ ፈትን',
    'showing': 'ዘርእይ',
    'to': 'ክሳብ',
    'of': 'ካብ',
    'members': 'ኣባላት',
    'previous': 'ቀዳማይ',
    'next': 'ቀጻማይ',
    
    // Registration Form
    'title': 'ደምድም ምዝገባ',
    'personalInfo': 'ውልቃዊ ሓፈሻዊ',
    'contactAddress': 'ኣድራሻ እንተሃልዩ',
    'familyInfo': 'ስድራቤት ሓፈሻዊ',
    'spiritualInfo': 'መንፈሳዊ ሓፈሻዊ',
    'contributionInfo': 'ወፈራ ሓፈሻዊ',
    'accountInfo': 'ኣካውንት ሓፈሻዊ',
    'submit': 'ምዝገባ ስደድ',
    'required': 'የድለ',
    'optional': 'ኣማራጺ',
    
    // Form Fields
    'first.name': 'ስም ቀዳማይ',
    'middle.name': 'ስም ማእከላይ',
    'last.name': 'ስም ናይ መወዳእታ',
    'first.name.required': 'ስም ቀዳማይ የድለ',
    'last.name.required': 'ስም ናይ መወዳእታ የድለ',
    'date.of.birth.required': 'ዕለተ ልደት የድለ',
    'phone.number.required': 'ቁጽሪ ስልኪ የድለ',
    'email.required': 'ኢመይል የድለ',
    'street.line1.required': 'ደብቲ መንገዲ የድለ',
    'city.required': 'ከተማ የድለ',
    'state.required': 'ግዛት የድለ',
    'postal.code.required': 'ዚፕ ኮድ የድለ',
    'country.required': 'ሃገር የድለ',
    'login.email.required': 'ኢመይል እተኻ የድለ',
    'password.required': 'መሕለፊ ቃል የድለ',
    'passwords.dont.match': 'መሕለፊ ቃላት ኣይሰማምዑን',
    'password.too.short': 'መሕለፊ ቃል ካብ 8 ፊደላት ክልቲኦም የድለ',
    
    // Additional Form Fields
    'email.address': 'ኢመይል ኢመይል',
    'apartment.suite.number': 'ቤት/ሱይት ቁጽሪ',
    'state.province': 'ግዛት/ግዝኣት',
    'spouse.name': 'ስም መርዓ',
    'spouse.contact.phone': 'ስልኪ መርዓ',
    'emergency.contact.name': 'ስም ተራኺል ሓጋዚ',
    'emergency.contact.phone': 'ስልኪ ተራኺል ሓጋዚ',
    'interested.in.serving': 'ኣብ ኣገልግሎት ተሻጋሪ',
    'tithe.participation': 'ክፍሊት ኣስማሚ',
    
    // Head of Household
    'head.of.household': 'ንስኻ መራሒ ቤተሰብካ እኹም ዲኻ?',
    'head.of.household.help': 'መርዓኻ እንተዘይተመዝገበ እዩ፣ እቶም እንተሃልዩ እሞ መራሒ ቤተሰብ ክትኮን እተኻ እሞ ኣኽትም። መራሒ ቤተሰብ ጥራይ እዩ ውልዲ/ተራኺል ክውስኽ ዘለዎ።',
    'head.of.household.email': 'ኢመይል መራሒ ቤተሰብ',
    'head.of.household.email.help': 'ኢመይል ናይቲ ዘሎ መራሒ ቤተሰብ ኣባል ኣእትው። እዚ ኢመይል እንተዘይተረኽበ፣ መራሒ ቤተሰብ ክትኮን እተኻ እሞ ኣኽትም።',
    'head.of.household.email.not.found': 'ብዚዝክር ኢመይል ኣባል ኣይተረኽበን። መራሒ ቤተሰብ ክትኮን እተኻ እሞ ኣኽትም ወይ ትኽክለኛ ኢመይል መራሒ ቤተሰብ ሃብ።',
    'has.dependents': 'ውልዲ ወይ ተራኺል ክኣኽትም እየ ዘለኹ',
    'has.dependents.help': 'እዚ ሳጹን እንተተሓትት ውልዲ ወይ ተራኺል ክትውስኽ እትደሊ እንተኾንካ። ካብ ዳሽቦርድካ ድማ ክትውስኾም ትኽእል እኹም።',
    
    // Processing
    'processing': 'Processing...',
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
    <LanguageContext.Provider value={{ language, currentLanguage: language, setLanguage, t }}>
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