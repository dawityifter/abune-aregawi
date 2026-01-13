import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';

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
    'view.youtube.channel': 'View Our Youtube Channel',

    // Section Headers
    'whats.happening': "What's Happening",
    'watch.listen': 'Watch or Listen',
    'participation': 'Participation Made Easy',
    'stay.connected': 'Stay Connected',
    'newcomer': 'New to Our Church?',
    'grow.spiritually': 'Grow Spiritually',
    'calendar.title': 'Orthodox Calendar 2025',
    'calendar.subtitle': 'Fasts & Feasts of the Year',
    'calendar.description': 'Our church observes the ancient liturgical calendar of the Ethiopian Orthodox Tewahedo Church. Stay updated with upcoming fasts, major feasts, and spiritual celebrations throughout the year.',
    'calendar.feasts': '9 Major Feasts',
    'calendar.fasts': '7 Major Fasts',
    'calendar.dailyBible': 'Daily Bible Readings & Commemorations',

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

    // First Login Modal
    'firstLoginModal.title': 'Complete your registration',
    'firstLoginModal.body': 'Welcome! Please complete your registration to join our church community, or continue browsing as a guest.',
    'firstLoginModal.ok': 'Continue to registration',
    'firstLoginModal.cancel': 'Cancel',

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

    // Dashboard Cards (New)
    'dashboard.welcome': 'Welcome',
    'dashboard.settingUp': 'Setting up your dashboard...',
    'dashboard.complete': 'Complete Registration',
    'dashboard.retry': 'Retry',
    'dashboard.incomplete.title': 'Incomplete Registration',
    'dashboard.incomplete.desc': 'Your registration is incomplete. Please finish the registration process to access all features.',

    'dashboard.profile.title': 'Profile',
    'dashboard.profile.view': 'View Profile',

    'dashboard.bylaw.title': 'Church Bylaw',
    'dashboard.bylaw.desc': 'View our church bylaws and constitution',
    'dashboard.bylaw.view': 'View Bylaws',

    'dashboard.dues.title': 'Member Dues',
    'dashboard.dues.viewAndPay': 'View and pay your membership dues',
    'dashboard.dues.dependentView': 'View household dues status',
    'dashboard.dues.view': 'View Dues',

    'dashboard.events.title': 'Events',
    'dashboard.events.upcoming': 'View upcoming church events',
    'dashboard.events.view': 'View Events',

    'dashboard.gallery.title': 'Photo Gallery',
    'dashboard.gallery.desc': 'View photos from our latest church events',
    'dashboard.gallery.view': 'View Gallery',

    'dashboard.service.title': 'Services & Departments',
    'dashboard.service.desc': 'Explore church ministries and departments',
    'dashboard.service.view': 'View Services',

    'dashboard.give.title': 'Giving',
    'dashboard.give.desc': 'Support our church mission',
    'dashboard.give.action': 'Donate',

    'dashboard.family.title': 'Family & Children',
    'dashboard.family.desc': 'Manage your family members and children',
    'dashboard.family.manage': 'Manage Family',

    'dashboard.communications.title': 'Communications',
    'dashboard.communications.desc': 'Send messages to church members',
    'dashboard.communications.open': 'Open Communications',

    'dashboard.relationships.title': 'Relationships & Outreach',
    'dashboard.relationships.desc': 'Manage member relationships and outreach',
    'dashboard.relationships.open': 'Open Dashboard',

    'dashboard.treasurer.title': 'Treasurer Dashboard',
    'dashboard.treasurer.desc': 'Manage church finances and records',
    'dashboard.treasurer.view': 'Open Treasurer Dashboard',

    'dashboard.admin.title': 'Admin Panel',
    'dashboard.admin.desc': 'Manage users, roles, and system settings',
    'dashboard.admin.access': 'Access Admin Panel',

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
    'admin.activity.logs': 'Activity Logs',
    'active': 'Active',
    'inactive': 'Inactive',
    'actions': 'Actions',
    'admin.messages': 'Messages',
    'admin.volunteer.requests': 'Volunteer Requests',
    'admin.volunteer.requests.desc': 'Members interested in serving',
    'admin.responded': 'Responded',
    'admin.call.requested': 'Call Requested',
    'admin.no.new.requests': 'No new volunteer requests',
    'admin.voicemail.inbox': 'Voicemail Inbox',
    'admin.refresh': 'Refresh',
    'admin.date': 'Date',
    'admin.from': 'From',
    'admin.duration': 'Duration',
    'admin.recording': 'Recording',
    'admin.transcription': 'Transcription',
    'admin.delete': 'Delete',
    'admin.no.voicemails': 'No voicemails found',
    'admin.unknown': 'Unknown',
    'admin.page': 'Page',
    'admin.loading.inbox': 'Loading inbox...',
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
    'priest.name': 'መልኣከ ፀሃይ Mel’Ake Tsehay keshi Tadesse',
    'priest.title': 'Our Church Father',
    'morning.prayers': 'Morning Prayers',
    'morning.prayers.time': '6:00 AM',
    'divine.liturgy': 'Divine Liturgy',
    'divine.liturgy.time': '9:00 AM',
    'church.address': '1621 S Jupiter Rd, Garland, TX 75042',
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

    // Board Members
    'board.title': 'Church Leadership',
    'board.subtitle': 'Dedicated servants working together for the glory of God and the growth of our community.',
    'board.card.desc': 'View our church leadership and board members',
    'board.view': 'View Leadership',
    'roles.chairman': 'Board Chairman',
    'roles.secretary': 'Secretary',
    'roles.treasurer': 'Treasurer',
    'roles.pr': 'Public Relations',
    'roles.auditor': 'Auditor',
    'roles.member': 'Member',
    'priest.bio': 'Leading our congregation with wisdom, humility, and unwavering faith. Serving the community through prayer, teachings, and spiritual guidance.',
    'board.currentMembers': 'Current Board Members',
    'board.volunteer.title': 'Called to Serve?',
    'board.volunteer.desc': 'Our church relies on the dedication of our members. If you are interested in joining a committee or running for a board position next term, please reach out.',
    'board.volunteer.action': 'Get Involved',

    // Registration Form (legacy keys - kept for compatibility)
    'title': 'Member Registration',
    'spiritualInfo': 'Spiritual Information',
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
    'head.of.household.phone': 'Head of Household Phone Number',
    'head.of.household.phone.help': 'Enter the phone number of the existing head of household member. This phone number must be registered as a head of household.',
    'head.of.household.phone.not.found': 'No head of household found with this phone number. Please register as head of household or provide a valid head of household phone number.',
    'head.of.household.phone.required': 'Head of household phone number is required when you are not the head of household.',
    'head.of.household.phone.validation.error': 'Error validating head of household phone number. Please try again.',
    'enter.head.of.household.phone': 'Enter head of household phone number',
    'has.dependents': 'I have children or dependents to register',
    'has.dependents.help': 'Check this box if you want to add children or dependents during registration. You can also add them later from your dashboard.',
    'is.baptized': 'Baptized in this Church?',

    // Sign In Page
    'welcome.back': 'Welcome Back',
    'sign.in.to.access.community': 'Sign in to access your church community',

    // Processing
    'processing': 'Processing...',

    // Missing Translation Keys - Registration & Authentication
    'member.registration': 'Member Registration',
    'complete.registration.to.join': 'Complete your registration to join our church community',
    'complete.registration': 'Complete Registration',
    'submitting': 'Submitting...',
    'participate.in.tithe': 'I would like to participate in tithing',

    // Registration Steps (updated format)
    'personal.information': 'Personal Information',
    'contact.information': 'Contact Information',
    'family.information': 'Family Information',
    'ministry.interests': 'Ministry Interests',
    'contribution.information': 'Contribution Information',

    // Registration Steps (MemberRegistration stepConfig keys)
    'personal.info': 'Personal Information',
    'contact.address': 'Contact & Address',
    'contribution.giving': 'Contribution & Giving',
    'account.info': 'Account Information',
    'dependents': 'Dependents',

    // Navigation & Actions
    'continue': 'Continue',
    'back': 'Back',
    'cancel': 'Cancel',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'warning': 'Warning',
    'info': 'Info',
    'edit': 'Edit',

    // Phone Authentication
    'send.code': 'Send Code',
    'enter.verification.code': 'Enter Verification Code',
    'verify.code': 'Verify Code',
    'email.password': 'Email/Password',
    'try.again': 'Try Again',

    // Error Messages
    'invalid.verification.code': 'Invalid verification code. Please try again.',
    'code.expired': 'Verification code has expired. Please request a new one.',
    'too.many.requests': 'Too many requests. Please wait a moment and try again.',
    'timeout': 'Request timed out. Please try again.',
    'network.error': 'Network error. Please check your connection.',
    'something.went.wrong': 'Something went wrong. Please try again.',
    'registration.successful': 'Registration completed successfully!',

    // Step Navigation
    'step.1': 'Step 1',
    'step.2': 'Step 2',
    'step.3': 'Step 3',
    'step.4': 'Step 4',
    'step.5': 'Step 5',

    // Additional Form Validation
    'spouse.name.required': 'Spouse name is required',
    'emergency.contact.name.required': 'Emergency contact name is required',
    'emergency.contact.phone.required': 'Emergency contact phone is required',

    // Gallery
    'gallery.title': 'Abune Aregawi Tigray Orthodox Church Gallery',
    'gallery.subtitle': 'Capturing moments of faith, community, and celebration',
    'gallery.upload': 'Upload Photo',
    'gallery.uploading': 'Uploading...',
    'gallery.uploadSuccess': 'Image uploaded successfully!',
    'gallery.uploadError': 'Failed to upload image. Ensure you have permission.',
    'gallery.invalidFormat': 'Only JPEG and PNG images are allowed.',
    'gallery.noImages': 'No images found in this gallery.',
    'gallery.loadError': 'Failed to load gallery images. Please try again later.',
    'gallery.counter': 'Image {current} of {total}',
    'common.previous': 'Previous',
    'common.next': 'Next',
    'common.back': 'Back',


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
    'view.youtube.channel': 'ቻነል ዩቲዩብና ርኣይ',

    // Section Headers
    'whats.happening': 'ምን እዩ ዘጋጥም',
    'watch.listen': 'ርኣይ ወይ ሰምዕ',
    'participation': 'ክፍሊት ቀሊል እዩ',
    'stay.connected': 'ተራኺልካ ክትነብር',
    'newcomer': 'ሓድሽ እኹም ኣብ ቤተ ክርስቲያንና?',
    'grow.spiritually': 'ብመንፈስ ክትሰፍሕ',
    'calendar.title': 'ናይ 2025 ዓውደ ኣዋርሕ ኦርቶዶክስ',
    'calendar.subtitle': 'ናይ ዓመቱ ጾምን በዓላትን',
    'calendar.description': 'ቤተ ክርስቲያንና ጥንታዊ ስነ-ስርዓት ዓውደ ኣዋርሕ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን ትኽተል። ብዛዕባ ዝመጽኡ ጾማት፣ ዓበይቲ በዓላት ከምኡ’ውን መንፈሳዊ ጽምብላት ንቐጻሊ ሓበሬታ ርኸቡ።',
    'calendar.feasts': '9 ዓበይቲ በዓላት',
    'calendar.fasts': '7 ዓበይቲ ጾማት',
    'calendar.dailyBible': 'ናይ መዓልቲ ንባብ ቅዱስ መጽሓፍን ዝኽርን',

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

    // First Login Modal (TODO: translate)
    'firstLoginModal.title': 'Complete your registration',
    'firstLoginModal.body': 'Welcome! Please complete your registration to join our church community, or continue browsing as a guest.',
    'firstLoginModal.ok': 'Continue to registration',
    'firstLoginModal.cancel': 'Cancel',

    // Sign In Page - New translations
    'welcome.back': 'እንቋዕ ብሰላም መጻእኩም',
    'sign.in.to.access.community': 'ናብ ማሕበረሰብ ቤተ ክርስቲያንኩም ንምእታው ተመዝገቡ',
    'sign.in.with.email.password': 'ብኢመይልን መሕለፊ ቃልን ተመዝገቡ',
    'sign.in.with.phone.number': 'ብቁጽሪ ስልኪ ተመዝገቡ',
    'email.address': 'ኢመይል ኣድራሻ',
    'enter.your.email': 'ኢመይልኩም ኣእትዉ',
    'enter.your.password': 'መሕለፊ ቃልኩም ኣእትዉ',
    'enter.10.digits': '10 ቁጽሪ ኣእትዉ',
    'enter.10.digits.auto.format': '10 ቁጽሪ ኣእትዉ (ንኣብነት 5551234567) - ብኣውቶማቲክ ይቐርጽ',
    'sending.otp': 'OTP እየ ልእኽ...',
    'send.otp.test.mode': 'OTP ልእኽ (ናይ ፈተነ ኣገባብ)',
    'send.otp': 'OTP ልእኽ',
    'complete.recaptcha.first': 'ቅድሚ ሕጂ reCAPTCHA ዛዝም',
    'enter.otp': 'OTP ኣእትዉ',
    'verifying': 'እየ ፈትሽ...',
    'verify.otp': 'OTP ፈትሽ',
    'try.again': 'ዳግማይ ፈትን',
    'no.auth.methods.available': 'ዝኾነ ናይ እተኻ ኣገባብ ኣይተረኽበን።',
    'contact.administrator.assistance': 'ሓገዝ ንምርካብ ንኣመሓዳሪ ተወከሱ።',

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

    // Dashboard Cards (New)
    'dashboard.welcome': 'እንቋዕ ብደሓን መጻእኩም',
    'dashboard.settingUp': 'ዳሽቦርድኩም ይዳሎ ኣሎ...',
    'dashboard.complete': 'ምዝገባ ዛዝም',
    'dashboard.retry': 'ዳግማይ ፈትን',
    'dashboard.incomplete.title': 'ምዝገባ ኣይተዛዘመን',
    'dashboard.incomplete.desc': 'ምዝገባኹም ሙሉእ ኣይኮነን። ኩሉ መራሕቲ ንምርካብ በጃኹም ምዝገባኹም ዛዝሙ።',

    'dashboard.profile.title': 'ፕሮፋይል',
    'dashboard.profile.view': 'ፕሮፋይል ርኣይ',

    'dashboard.bylaw.title': 'ሕጊ ቤተ ክርስቲያን',
    'dashboard.bylaw.desc': 'ሕገ ቤተ ክርስቲያንን መምርሒታትን ርኣዩ',
    'dashboard.bylaw.view': 'ሕጊ ርኣይ',

    'dashboard.dues.title': 'ክፍሊት ኣባላት',
    'dashboard.dues.viewAndPay': 'ክፍሊት ኣባላት ርኣዩን ክፈሉን',
    'dashboard.dues.dependentView': 'ናይ ቤተሰብ ክፍሊት ኩነታት ርኣዩ',
    'dashboard.dues.view': 'ክፍሊት ርኣይ',

    'dashboard.events.title': 'መደባት',
    'dashboard.events.upcoming': 'ዝመጽኡ መደባት ቤተ ክርስቲያን ርኣዩ',
    'dashboard.events.view': 'መደባት ርኣይ',

    'dashboard.gallery.title': 'ስእሊ ቤተ ክርስቲያን',
    'dashboard.gallery.desc': 'ናይ ቤተ ክርስቲያንና ሓድሽ ስእሊታት ርኣዩ',
    'dashboard.gallery.view': 'ስእሊ ርኣይ',

    'dashboard.service.title': 'ኣገልግሎትን ክፍለ-ሰራዊትን',
    'dashboard.service.desc': 'ናይ ቤተ ክርስቲያን ኣገልግሎታትን ክፍለ-ሰራዊትን ርኣዩ',
    'dashboard.service.view': 'ኣገልግሎት ርኣይ',

    'dashboard.give.title': 'ወፈያ',
    'dashboard.give.desc': 'ንቤተ ክርስቲያንና ደግፉ',
    'dashboard.give.action': 'ወፈያ ሃብ',

    'dashboard.family.title': 'ቤተሰብን ህጻናትን',
    'dashboard.family.desc': 'ቤተሰብኩምን ህጻናትኩምን ኣመሓድሩ',
    'dashboard.family.manage': 'ቤተሰብ ኣመሓድር',

    'dashboard.communications.title': 'ርኽብ',
    'dashboard.communications.desc': 'ንኣባላት ቤተ ክርስቲያን መልእኽቲ ስደዱ',
    'dashboard.communications.open': 'ርኽብ ክፈት',

    'dashboard.relationships.title': 'ርኽብን ተልእኾን',
    'dashboard.relationships.desc': 'ናይ ኣባላት ርኽብን ተልእኾን ኣመሓድሩ',
    'dashboard.relationships.open': 'ዳሽቦርድ ክፈት',

    'dashboard.treasurer.title': 'ዳሽቦርድ ተሓዚ ገንዘብ',
    'dashboard.treasurer.desc': 'ናይ ቤተ ክርስቲያን ገንዘብን መዝገብን ኣመሓድሩ',
    'dashboard.treasurer.view': 'ዳሽቦርድ ተሓዚ ገንዘብ ክፈት',

    'dashboard.admin.title': 'ፓነል ኣመሓዳሪ',
    'dashboard.admin.desc': 'ተጠቀምቲ፣ መራሕትን ቅንጡፍትን ኣመሓድሩ',
    'dashboard.admin.access': 'ናብ ፓነል ኣመሓዳሪ እተ',

    // Profile
    'edit.profile': 'ፕሮፋይል ኣምልስ',
    'profile.information': 'ሓበሬታ ፕሮፋይል',
    'basic.information': 'ቀንዲ ሓበሬታታት',
    'full.name': 'ምሉእ ስም',
    'member.since': 'ካብ መዓስ ኣባል',
    'date.of.birth': 'ዕለተ ልደት',
    'church.information': 'ሓበሬታ ቤተ ክርስቲያን',
    'name.day': 'ዕለተ ስም',
    'liturgical.role': 'ሓላፍነት ስነ ቅልስ',
    'language.preference': 'ቋንቋ ተሻጋሪ',
    'emergency.contact': 'ተራኺል ሓጋዚ',
    'emergency.phone': 'ስልኪ ሓጋዚ',
    'edit': 'ኣምልስ',
    'cancel': 'ሰርዝ',
    'saving': 'እየ ኣቀምጥ...',
    'not.provided': 'ዘይተሃበ',
    'select.gender': 'ፆታ ምረጽ',
    'male': 'ወዲ',
    'female': 'ሰበይቲ',
    'other': 'ካልእ',
    'none': 'ሓንቲ',
    'reader': 'ኣንቀጸባር',
    'deacon': 'ዲያቆን',
    'priest': 'ካህን',
    'priest.name': 'ቀሲስ ታደሰ',
    'priest.title': 'ርእሰ ደብሪ',
    'morning.prayers': 'ቀዳማይ ጸሎት',
    'morning.prayers.time': '6:00 ሰዓት',
    'divine.liturgy': 'ቅዳሴ',
    'divine.liturgy.time': '9:00 ሰዓት',
    'church.address': '1621 S Jupiter Rd, Garland, TX 75042',
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
    'is.baptized': 'ኣብዚ ቤተ ክርስቲያን ዝተጠመተ ዲኦ?',
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

    // Board Members
    'board.title': 'መራሕቲ ቤተ ክርስቲያን',
    'board.subtitle': 'ንኽብሪ እግዚኣብሔርን ንዕብየት ማሕበረሰብናን ብሓባር ዝሰርሑ እሙናት ኣገልገልቲ።',
    'board.card.desc': 'ናይ ቤተ ክርስቲያን መራሕትን ቦርድ ኣባላትን ርኣዩ',
    'board.view': 'መራሕቲ ርኣይ',
    'roles.chairman': 'ቦርድ ኣቦ ወንበር',
    'roles.secretary': 'ጸሓፊ',
    'roles.treasurer': 'ተሓዚ ገንዘብ',
    'roles.pr': 'ህዝቢ ርኽብ',
    'roles.auditor': 'ኦዲተር',
    'roles.member': 'ኣባል',
    'priest.bio': 'ንምእመናንና ብጥበብ፣ ትሕትናን ጽኑዕ እምነትን ይመርሑ። ንማሕበረሰብና ብጸሎት፣ ትምህርትን መንፈሳዊ መሪሕነትን የገልግሉ።',
    'board.currentMembers': 'ናይ ሕዚ ቦርድ ኣባላት',
    'board.volunteer.title': 'ንምግልጋል ተጸውዕኩምዶ?',
    'board.volunteer.desc': 'ቤተ ክርስቲያንና ኣብ ተወፉይነት ኣባላትና እያ ትምርኮስ። ኣብ ኮሚተ ንምስታፍ ወይ ንዝመጽእ ግዜ ንቦርድ ንምወዳደር ድሌት እንተለኩም፣ በጃኹም ተወከሱና።',
    'board.volunteer.action': 'ተሳትፉ',
    'admin.messages': 'መልእኽትታት',
    'admin.activity.logs': 'ናይ ንጥፈታት መዝገብ',
    'admin.volunteer.requests': 'ናይ ተወፉይነት ጠለባት',
    'admin.volunteer.requests.desc': 'ንምግልጋል ድሌት ዘለዎም ኣባላት',
    'admin.responded': 'ተራኺበሎም',
    'admin.call.requested': 'ደወል ተሓቲቱ',
    'admin.no.new.requests': 'ሓድሽ ናይ ተወፉይነት ጠለብ የለን',
    'admin.voicemail.inbox': 'መልእኽቲ ድምጺ',
    'admin.refresh': 'ኣሐድስ',
    'admin.date': 'ዕለት',
    'admin.from': 'ካብ',
    'admin.duration': 'ንውሓት',
    'admin.recording': 'ድምጺ',
    'admin.transcription': 'ጽሑፍ',
    'admin.delete': 'ሰርዝ',
    'admin.no.voicemails': 'ዝኾነ መልእኽቲ ድምጺ ኣይተረኽበን',
    'admin.unknown': 'ዘይፍለጥ',
    'admin.page': 'ገጽ',
    'admin.loading.inbox': 'መልእኽቲ ይጽዓን ኣሎ...',

    // Registration Form (legacy keys - kept for compatibility)
    'title': 'ምዝገባ ኣባል',
    'spiritualInfo': 'መንፈሳዊ ሓፈሻዊ',
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

    // Missing Translation Keys - Registration & Authentication
    'member.registration': 'ምዝገባ ኣባል',
    'complete.registration.to.join': 'ናብ ቤተ ክርስቲያንና ክትጽንበር ምዝገባኻ ዛዝም',
    'complete.registration': 'ምዝገባ ዛዝም',
    'submitting': 'ይስደድ ኣሎ...',
    'participate.in.tithe': 'ኣብ ዓስራይ ክሳተፍ እየ ዘለኹ',

    // Registration Steps
    'personal.information': 'ውልቃዊ ሓፈሻዊ',
    'contact.information': 'ተራኺብ ሓፈሻዊ',
    'family.information': 'ቤተሰብ ሓፈሻዊ',
    'ministry.interests': 'ኣገልግሎት ድሌታት',
    'contribution.information': 'ወፈራ ሓፈሻዊ',

    // Navigation & Actions
    'continue': 'ቀጽል',
    'back': 'ተመለስ',
    'loading': 'ይጽዓን ኣሎ...',
    'error': 'ጌጋ',
    'success': 'ዓወት',
    'warning': 'ጠንቂ',
    'info': 'ሓፈሻዊ',

    // Phone Authentication
    'send.code': 'ኮድ ስደድ',
    'enter.verification.code': 'ናይ ምርግጋጽ ኮድ ኣእትው',
    'verify.code': 'ኮድ ኣረጋግጽ',
    'phone.number': 'ቁጽሪ ስልኪ',
    'email.password': 'ኢመይል/መሕለፊ ቃል',

    // Error Messages
    'invalid.verification.code': 'ዘይትኽክል ናይ ምርግጋጽ ኮድ። ዳግማይ ፈትን።',
    'code.expired': 'ናይ ምርግጋጽ ኮድ ጊዜኡ ሓሊፉ። ሓድሽ ሕተት።',
    'too.many.requests': 'ብዙሕ ሕቶታት። ሓንቲ ደቒቕ ጸበ።',
    'timeout': 'ጊዜ ሓሊፉ። ዳግማይ ፈትን።',
    'network.error': 'ናይ መርበብ ጌጋ። ምትእስሳርካ ኣረጋግጽ።',
    'something.went.wrong': 'ሓደ ነገር ጌጋ ኮይኑ። ዳግማይ ፈትን።',
    'registration.successful': 'ምዝገባ ብዓወት ተዛዚሙ!',

    // Step Navigation
    'step.1': 'ደረጃ 1',
    'step.2': 'ደረጃ 2',
    'step.3': 'ደረጃ 3',
    'step.4': 'ደረጃ 4',
    'step.5': 'ደረጃ 5',

    // Additional Form Validation
    'spouse.name.required': 'ስም መርዓ የድለ',
    'emergency.contact.name.required': 'ስም ተራኺል ሓጋዚ የድለ',
    'emergency.contact.phone.required': 'ስልኪ ተራኺል ሓጋዚ የድለ',

    // Gallery
    'gallery.title': 'ደብረ ጸሓይ አቡነ አረጋዊ ቤተ ክርስቲያን ስእሊ',
    'gallery.subtitle': 'ናይ እምነት፣ ማሕበረሰብን በዓላትን ህሞታት',
    'gallery.upload': 'ስእሊ ጽዓን',
    'gallery.uploading': 'ይጽዓን ኣሎ...',
    'gallery.uploadSuccess': 'ስእሊ ብዓወት ተጻዒኑ!',
    'gallery.uploadError': 'ስእሊ ምጽዓን ኣይተኻእለን። ፍቃድ ከም ዘለኩም ኣረጋግጹ።',
    'gallery.invalidFormat': 'JPEGን PNGን ዝዓይነቱ ስእሊ ጥራይ እዩ ዝፍቀድ።',
    'gallery.noImages': 'ኣብዚ ማህደር ዝኾነ ስእሊ ኣይተረኽበን።',
    'gallery.loadError': 'ስእሊታት ምምጻእ ኣይተኻእለን። በጃኹም ደሓር ፈትኑ።',
    'gallery.counter': 'ስእሊ {current} ካብ {total}',
    'common.previous': 'ዝሓለፈ',
    'common.next': 'ቀጻሊ',
    'common.back': 'ተመለስ',


  }
};



export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use the source of truth from I18nProvider (which envelops this provider in App.tsx/index.tsx)
  const { lang, setLang, t: i18nT } = useI18n();

  // Redirect setLanguage to update the central state
  const setLanguage = (newLang: Language) => {
    setLang(newLang);
  };

  const t = (key: string): string => {
    // 1. Try global dictionary (dictionaries.ts) via i18n provider
    // The i18nT function returns the key if not found.
    const globalMatch = i18nT(key);
    if (globalMatch !== key) {
      return globalMatch;
    }

    // 2. Try local translations (legacy)
    const currentTranslation = translations[lang][key as keyof typeof translations[typeof lang]];
    if (currentTranslation) {
      return currentTranslation;
    }

    // 3. Fallback: try English in local translations if missing
    if (lang !== 'en') {
      const englishTranslation = translations.en[key as keyof typeof translations.en];
      if (englishTranslation) {
        return englishTranslation;
      }
    }

    // 4. Last resort: convert dotted key to readable text
    return key
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // We rely on I18nProvider to handle localStorage persistence

  return (
    <LanguageContext.Provider value={{ language: lang, currentLanguage: lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 