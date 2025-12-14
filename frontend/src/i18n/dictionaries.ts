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
    welcomeBack: string;
    loginSubtitle: string;
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
  treasurerDashboard: {
    title: string;
    subtitle: string;
    tabs: {
      overview: string;
      payments: string;
      expenses: string;
      reports: string;
      zelle: string;
      memberDues: string;
      employees: string;
      vendors: string;
    };
    actions: {
      addPayment: string;
      addExpense: string;
      searchMember: string;
    };
    overview: {
      title: string;
    };
    reports: {
      weeklyCollection: string;
      paymentReports: string;
    };
    memberDues: {
      title: string;
      subtitle: string;
      searchTitle: string;
      searchDesc: string;
      searchNote: string;
    };
    access: {
      denied: string;
      deniedDesc: string;
    };
    stats: {
      totalMembers: string;
      contributingMembers: string;
      upToDate: string;
      behind: string;
      collectionRate: string;
      membershipCollected: string;
      otherPayments: string;
      totalCollected: string;
      totalExpenses: string;
      netIncome: string;
      outstanding: string;
      collectionProgress: string;
    };
    transactionList: {
      filters: {
        memberSearch: string;
        receiptNumber: string;
        paymentType: string;
        paymentMethod: string;
        dateRange: string;
        startDate: string;
        endDate: string;
        apply: string;
        placeholder: {
          search: string;
          receipt: string;
        };
        options: {
          allTypes: string;
          allMethods: string;
          allTime: string;
          today: string;
          week: string;
          month: string;
          year: string;
          custom: string;
        };
      };
      table: {
        date: string;
        memberId: string;
        member: string;
        amount: string;
        type: string;
        glCode: string;
        method: string;
        status: string;
        collectedBy: string;
        receipt: string;
        notes: string;
      };
      types: {
        membership_due: string;
        tithe: string;
        donation: string;
        event: string;
        other: string;
      };
      methods: {
        cash: string;
        check: string;
        zelle: string;
        credit_card: string;
        debit_card: string;
        ach: string;
        other: string;
      };
      status: {
        pending: string;
        succeeded: string;
        failed: string;
        canceled: string;
      };
      pagination: {
        page: string;
        of: string;
        previous: string;
        next: string;
      };
      empty: {
        title: string;
        desc: string;
      };
    };
    expenses: {
      filters: {
        title: string;
        startDate: string;
        endDate: string;
        category: string;
        paymentMethod: string;
        clear: string;
        allCategories: string;
        allMethods: string;
      };
      table: {
        title: string;
        date: string;
        category: string;
        payee: string;
        amount: string;
        method: string;
        checkNumber: string;
        recordedBy: string;
        memo: string;
        employee: string;
        vendor: string;
        loading: string;
        empty: string;
      };
      addModal: {
        title: string;
        amount: string;
        date: string;
        category: string;
        payeeType: string;
        paymentMethod: string;
        checkNumber: string;
        receiptNumber: string;
        memo: string;
        cancel: string;
        save: string;
        saving: string;
        select: string;
        types: {
          employee: string;
          vendor: string;
          other: string;
        };
      };
    };
    reportTabs: {
      weekly: {
        title: string;
        previous: string;
        next: string;
        netDeposit: string;
        income: string;
        transactions: string;
        netToDeposit: string;
        details: string;
        hide: string;
        show: string;
        empty: string;
      };
      paymentReports: {
        type: string;
        generate: string;
        loading: string;
        types: {
          summary: string;
          behind: string;
          monthly: string;
        };
        summary: {
          totalMembers: string;
          upToDate: string;
          behind: string;
          collectionRate: string;
          totalDue: string;
          totalCollected: string;
        };
        behind: {
          title: string;
          member: string;
          contact: string;
          totalDue: string;
          collected: string;
          balance: string;
        };
        monthly: {
          title: string;
          totalCollected: string;
        };
      };
    };
  };
  admin: {
    dashboard: string;
    welcome: string;
    manageMembers: string;
    roleManagement: string;
    departments: string;
    common: {
      actions: string;
      search: string;
      filter: string;
      status: string;
      role: string;
      all: string;
      active: string;
      inactive: string;
      cancel: string;
      save: string;
      loading: string;
      retry: string;
      next: string;
      previous: string;
      of: string;
      page: string;
      results: string;
      showing: string;
      to: string;
      confirmDelete: string;
      noData: string;
      create: string;
      edit: string;
      delete: string;
      update: string;
      view: string;
    };
    members: {
      title: string;
      addMember: string;
      addDependent: string;
      manageDependents: string;
      stats: {
        totalHouseholds: string;
        registeredMembers: string;
        totalDependents: string;
        familyMembers: string;
        totalCongregation: string;
        householdsAndDependents: string;
        description: string;
      };
      table: {
        name: string;
        email: string;
        phone: string;
        role: string;
        status: string;
        dependents: string;
      };
    };
    roles: {
      title: string;
      description: string;
      stats: {
        members: string;
      };
      updateRole: string;
      currentRole: string;
      newRole: string;
      changeRole: string;
      updatingFor: string;
      updating: string;
    };

    departmentSection: {
      title: string;
      description: string;
      create: string;
      stats: {
        total: string;
        enrolled: string;
        byType: string;
      };
      types: {
        ministry: string;
        committee: string;
        service: string;
        social: string;
        administrative: string;
      };
      empty: {
        title: string;
        action: string;
      };
    };
    memberModal: {
      editTitle: string;
      tabs: {
        basic: string;
        contact: string;
        spiritual: string;
        family: string;
      };
      sections: {
        personal: string;
        address: string;
        church: string;
      };
      fields: {
        firstName: string;
        middleName: string;
        lastName: string;
        email: string;
        phone: string;
        gender: string;
        dob: string;
        maritalStatus: string;
        yearlyPledge: string;
        baptismName: string;
        role: string;
        status: string;
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
        joinedParish: string;
        givingMethod: string;
        interestedServing: string;
        spouseName: string;
        spouseEmail: string;
        emergencyName: string;
        emergencyPhone: string;
        language: string;
      };
      placeholders: {
        selectGender: string;
        selectMaritalStatus: string;
        selectRole: string;
        selectStatus: string;
        selectLanguage: string;
        selectGivingMethod: string;
        selectOption: string;
      };
      options: {
        male: string;
        female: string;
        other: string;
        single: string;
        married: string;
        divorced: string;
        widowed: string;
        yes: string;
        no: string;
        maybe: string;
        cash: string;
        check: string;
        online: string;
        bank_transfer: string;
        active: string;
        inactive: string;
      };
      family: {
        linked: string;
        addDependent: string;
        noDependents: string;
        promote: string;
      };
      actions: {
        save: string;
        saving: string;
        cancel: string;
        delete: string;
        edit: string;
      };
    };
    departmentModal: {
      create: string;
      edit: string;
      manageMembers: string;
      fields: {
        name: string;
        description: string;
        type: string;
        parent: string;
        leader: string;
        meetingSchedule: string;
        maxMembers: string;
        public: string;
        active: string;
        contactEmail: string;
        contactPhone: string;
      };
      placeholders: {
        searchLeader: string;
        selectLeader: string;
        searchMembers: string;
        none: string;
      };
      types: {
        ministry: string;
        committee: string;
        service: string;
        social: string;
        administrative: string;
      };
      members: {
        add: string;
        selectToAdd: string;
        current: string;
        noMembers: string;
        allAdded: string;
        noResults: string;
        addSelected: string;
      };
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
    welcomeBack: "Welcome Back",
    loginSubtitle: "Sign in to access your community account",
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
  },
  treasurerDashboard: {
    title: "Treasurer Dashboard",
    subtitle: "Manage member payments and generate reports",
    tabs: {
      overview: "Overview",
      payments: "Member Payments",
      expenses: "Expenses",
      reports: "Reports",
      zelle: "Zelle Review",
      memberDues: "Member Dues",
      employees: "Employees",
      vendors: "Vendors"
    },
    actions: {
      addPayment: "Add Payment",
      addExpense: "Add Expense",
      searchMember: "Search Member"
    },
    overview: {
      title: "Payment Overview"
    },
    reports: {
      weeklyCollection: "📅 Weekly Collection Report",
      paymentReports: "Payment Reports"
    },
    memberDues: {
      title: "Member Dues Viewer",
      subtitle: "View any member's dues and payment history",
      searchTitle: "Search for a Member",
      searchDesc: "Click the \"Search Member\" button above to find a member and view their dues and payment history.",
      searchNote: "You'll see the same information that members see on their /dues page."
    },
    access: {
      denied: "Access Denied",
      deniedDesc: "You don't have permission to access the Treasurer Dashboard."
    },
    stats: {
      totalMembers: "Total Members",
      contributingMembers: "Contributing Members",
      upToDate: "Up to Date",
      behind: "Behind on Payments",
      collectionRate: "Collection Rate",
      membershipCollected: "Membership Collected",
      otherPayments: "Other Payments",
      totalCollected: "Total Collected",
      totalExpenses: "Total Expenses",
      netIncome: "Net Income",
      outstanding: "Outstanding Amount",
      collectionProgress: "Collection Progress"
    },
    transactionList: {
      filters: {
        memberSearch: "Member Search",
        receiptNumber: "Receipt Number",
        paymentType: "Payment Type",
        paymentMethod: "Payment Method",
        dateRange: "Date Range",
        startDate: "Start Date",
        endDate: "End Date",
        apply: "Apply Filters",
        placeholder: {
          search: "Search member (min 3 chars)...",
          receipt: "Search receipt #..."
        },
        options: {
          allTypes: "All Types",
          allMethods: "All Methods",
          allTime: "All Time",
          today: "Today",
          week: "Last 7 Days",
          month: "Last 30 Days",
          year: "Last Year",
          custom: "Custom Range"
        }
      },
      table: {
        date: "Date",
        memberId: "Member ID",
        member: "Member",
        amount: "Amount",
        type: "Type",
        glCode: "GL Code",
        method: "Method",
        status: "Status",
        collectedBy: "Collected By",
        receipt: "Receipt",
        notes: "Notes"
      },
      types: {
        membership_due: "Membership Due",
        tithe: "Tithe",
        donation: "Donation",
        event: "Event",
        other: "Other"
      },
      methods: {
        cash: "Cash",
        check: "Check",
        zelle: "Zelle",
        credit_card: "Credit Card",
        debit_card: "Debit Card",
        ach: "ACH",
        other: "Other"
      },
      status: {
        pending: "Pending",
        succeeded: "Succeeded",
        failed: "Failed",
        canceled: "Canceled"
      },
      pagination: {
        page: "Page",
        of: "of",
        previous: "Previous",
        next: "Next"
      },
      empty: {
        title: "No transactions found",
        desc: "Try adjusting your filters or add a new transaction."
      }
    },
    expenses: {
      filters: {
        title: "Filters",
        startDate: "Start Date",
        endDate: "End Date",
        category: "Category",
        paymentMethod: "Payment Method",
        clear: "Clear all filters",
        allCategories: "All Categories",
        allMethods: "All Methods"
      },
      table: {
        title: "Expenses",
        date: "Date",
        category: "Category",
        payee: "Payee",
        amount: "Amount",
        method: "Method",
        checkNumber: "Check #",
        recordedBy: "Recorded By",
        memo: "Memo",
        employee: "Employee",
        vendor: "Vendor",
        loading: "Loading expenses...",
        empty: "No expenses found."
      },
      addModal: {
        title: "Add Expense",
        amount: "Amount",
        date: "Date",
        category: "Category",
        payeeType: "Payee Type",
        paymentMethod: "Payment Method",
        checkNumber: "Check Number",
        receiptNumber: "Receipt Number",
        memo: "Memo",
        cancel: "Cancel",
        save: "Save Expense",
        saving: "Saving...",
        select: "Select...",
        types: {
          employee: "Employee",
          vendor: "Vendor",
          other: "Other"
        }
      }
    },
    reportTabs: {
      weekly: {
        title: "📅 Weekly Collection Report",
        previous: "Previous Week",
        next: "Next Week",
        netDeposit: "💰 Net Deposit",
        income: "Total Income",
        transactions: "Transactions",
        netToDeposit: "Net to Deposit",
        details: "Details",
        hide: "Hide",
        show: "Show",
        empty: "No transactions found for this week"
      },
      paymentReports: {
        type: "Report Type:",
        generate: "Generate Report",
        loading: "Loading reports...",
        types: {
          summary: "Summary Report",
          behind: "Behind on Payments",
          monthly: "Monthly Breakdown"
        },
        summary: {
          totalMembers: "Total Members",
          upToDate: "Up to Date",
          behind: "Behind",
          collectionRate: "Collection Rate",
          totalDue: "Total Due",
          totalCollected: "Total Collected"
        },
        behind: {
          title: "Members Behind on Payments",
          member: "Member",
          contact: "Contact",
          totalDue: "Total Due",
          collected: "Collected",
          balance: "Balance"
        },
        monthly: {
          title: "Monthly Collection Report",
          totalCollected: "Total Collected"
        }
      }
    }
  },
  admin: {
    dashboard: "Admin Dashboard",
    welcome: "Welcome",
    manageMembers: "Manage Members",
    roleManagement: "Role Management",
    departments: "Departments",
    common: {
      actions: "Actions",
      search: "Search",
      filter: "Filter",
      status: "Status",
      role: "Role",
      all: "All",
      active: "Active",
      inactive: "Inactive",
      cancel: "Cancel",
      save: "Save",
      loading: "Loading...",
      retry: "Retry",
      next: "Next",
      previous: "Previous",
      of: "of",
      page: "Page",
      results: "Results",
      showing: "Showing",
      to: "to",
      confirmDelete: "Are you sure you want to delete this?",
      noData: "No data found",
      create: "Create",
      edit: "Edit",
      delete: "Delete",
      update: "Update",
      view: "View"
    },
    members: {
      title: "Manage Members",
      addMember: "Add Member",
      addDependent: "Add Dependent",
      manageDependents: "Manage Dependents",
      stats: {
        totalHouseholds: "Total Households",
        registeredMembers: "Registered Members",
        totalDependents: "Total Dependents",
        familyMembers: "Family Members",
        totalCongregation: "Total Congregation",
        householdsAndDependents: "Households + Dependents",
        description: "Total individuals connected to the church community"
      },
      table: {
        name: "Name",
        email: "Email",
        phone: "Phone",
        role: "Role",
        status: "Status",
        dependents: "Dependents"
      }
    },
    roles: {
      title: "Role Management",
      description: "Manage member roles and permissions",
      stats: {
        members: "members"
      },
      updateRole: "Update Role",
      currentRole: "Current Role",
      newRole: "New Role",
      changeRole: "Change Role",
      updatingFor: "Updating role for",
      updating: "Updating..."
    },
    departmentSection: {
      title: "Departments & Ministries",
      description: "Manage church departments and ministry groups",
      create: "Create Department",
      stats: {
        total: "Total Departments",
        enrolled: "Members Enrolled",
        byType: "By Type"
      },
      types: {
        ministry: "Ministry",
        committee: "Committee",
        service: "Service",
        social: "Social",
        administrative: "Administrative"
      },
      empty: {
        title: "No departments found",
        action: "Create your first department"
      }
    },
    memberModal: {
      editTitle: "Edit Member",
      tabs: {
        basic: "Basic Info",
        contact: "Contact Info",
        spiritual: "Spiritual Info",
        family: "Family Info"
      },
      sections: {
        personal: "Personal Details",
        address: "Address",
        church: "Church Details"
      },
      fields: {
        firstName: "First Name",
        middleName: "Middle Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone Number",
        gender: "Gender",
        dob: "Date of Birth",
        maritalStatus: "Marital Status",
        yearlyPledge: "Yearly Pledge",
        baptismName: "Baptism Name",
        role: "Role",
        status: "Status",
        street: "Street Address",
        city: "City",
        state: "State",
        zip: "Postal Code",
        country: "Country",
        joinedParish: "Date Joined Parish",
        givingMethod: "Preferred Giving Method",
        interestedServing: "Interested in Serving",
        spouseName: "Spouse Name",
        spouseEmail: "Spouse Email",
        emergencyName: "Emergency Contact",
        emergencyPhone: "Emergency Phone",
        language: "Language Preference"
      },
      placeholders: {
        selectGender: "Select Gender",
        selectMaritalStatus: "Select Marital Status",
        selectRole: "Select Role",
        selectStatus: "Select Status",
        selectLanguage: "Select Language",
        selectGivingMethod: "Select Giving Method",
        selectOption: "Select Option"
      },
      options: {
        male: "Male",
        female: "Female",
        other: "Other",
        single: "Single",
        married: "Married",
        divorced: "Divorced",
        widowed: "Widowed",
        yes: "Yes",
        no: "No",
        maybe: "Maybe",
        cash: "Cash",
        check: "Check",
        online: "Online",
        bank_transfer: "Bank Transfer",
        active: "Active",
        inactive: "Inactive"
      },
      family: {
        linked: "This member is part of a household (Family ID: {id}). Payments are aggregated.",
        addDependent: "Add Dependent",
        noDependents: "No dependents added yet.",
        promote: "Promote to Member"
      },
      actions: {
        save: "Save Changes",
        saving: "Saving...",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit"
      }
    },
    departmentModal: {
      create: "Create Department",
      edit: "Edit Department",
      manageMembers: "Manage Members",
      fields: {
        name: "Department Name",
        description: "Description",
        type: "Type",
        parent: "Parent Department",
        leader: "Leader",
        meetingSchedule: "Meeting Schedule",
        maxMembers: "Max Members",
        public: "Public Department",
        active: "Active",
        contactEmail: "Contact Email",
        contactPhone: "Contact Phone"
      },
      placeholders: {
        searchLeader: "Search by name, ID, or phone...",
        selectLeader: "Select Leader",
        searchMembers: "Search by name, ID, or phone...",
        none: "None (Top Level)"
      },
      types: {
        ministry: "Ministry",
        committee: "Committee",
        service: "Service",
        social: "Social",
        administrative: "Administrative"
      },
      members: {
        add: "Add Members",
        selectToAdd: "Select Members to Add",
        current: "Current Members",
        noMembers: "No members in this department yet",
        allAdded: "All members have been added",
        noResults: "No members found matching your search",
        addSelected: "Add Selected"
      }
    }
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
    welcomeBack: "እንኳዕ ብደሓን መጻእኩም",
    loginSubtitle: "ናብ ማሕበረሰብ ኣካውንትኩም ንምእታው እተኻ",
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
      title: "መግለፂ",
      view: "መግለፂ ርኣይ"
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
  },
  treasurerDashboard: {
    title: "ዳሽቦርድ ተሓዝ ገንዘብ",
    subtitle: "ክፍሊት ኣባላትን ጸብጻባትን ምምሕዳር",
    tabs: {
      overview: "ሓፈሻዊ",
      payments: "ክፍሊት ኣባላት",
      expenses: "ወጪታት",
      reports: "ጸብጻባት",
      zelle: "ዘለ (Zelle) ክፍሊታት",
      memberDues: "ወርሓዊ ክፍሊት",
      employees: "ሰራሕተኛታት",
      vendors: "ሻየጥቲ"
    },
    actions: {
      addPayment: "ክፍሊት ወስኽ",
      addExpense: "ወጪ ወስኽ",
      searchMember: "ኣባል ድለ"
    },
    overview: {
      title: "ሓፈሻዊ ክፍሊት"
    },
    reports: {
      weeklyCollection: "📅 ሰሙናዊ ጸብጻብ ክፍሊት",
      paymentReports: "ጸብጻብ ክፍሊታት"
    },
    memberDues: {
      title: "መርኣዪ ወርሓዊ ክፍሊት",
      subtitle: "ናይ ዝኾነ ኣባል ክፍሊትን ታሪኽን ርኣይ",
      searchTitle: "ኣባል ድለ",
      searchDesc: "\"ኣባል ድለ\" ዝብል መልፊ ብምጥዋቕ ኣባል ድለዩ፡ ድሕሪኡ ቀዋሚ ወርሓዊ ክፍሊቶም ክትርእዩ ኢኹም።",
      searchNote: "እዚ ሓበሬታ እዚ፡ ኣባላት ኣብ ናቶም /dues ዝርእይዎ ዓይነት እዩ።"
    },
    access: {
      denied: "ፍቓድ የብልካን",
      deniedDesc: "ናብዚ ክፍሊ (ዳሽቦርድ ተሓዝ ገንዘብ) ንምእታው ፍቓድ የብልካን።"
    },
    stats: {
      totalMembers: "ጠቕላላ ኣባላት",
      contributingMembers: "ዝኸፍሉ ኣባላት",
      upToDate: "እዋናዊ ዝኸፈሉ",
      behind: "ክፍሊት ዝተረፎም",
      collectionRate: " መጠን ኣከባብ ክፍሊት",
      membershipCollected: "ዝተኣከበ ክፍሊት ኣባላት",
      otherPayments: "ካልኦት ክፍሊታት",
      totalCollected: "ጠቕላላ ዝተኣከበ",
      totalExpenses: "ጠቕላላ ወጪ",
      netIncome: "ዝተረፈ እቶት",
      outstanding: "ዝተረፈ ክፍሊት",
      collectionProgress: "ትልሚ ኣከባብ ክፍሊት"
    },
    transactionList: {
      filters: {
        memberSearch: "ኣባል ድለ",
        receiptNumber: "ቁጽሪ ቅብሊት",
        paymentType: "ዓይነት ክፍሊት",
        paymentMethod: "ገባሪ ክፍሊት",
        dateRange: "እዋን",
        startDate: "መጀመሪ ዕለት",
        endDate: "መወዳእታ ዕለት",
        apply: "ኣጣሪ",
        placeholder: {
          search: "ኣባል ድለ (ብውሑዱ 3 ፊደላት)...",
          receipt: "ቁጽሪ ቅብሊት ድለ..."
        },
        options: {
          allTypes: "ኩሉ ዓይነት",
          allMethods: "ኩሉ ገባሪ",
          allTime: "ኩሉ ግዜ",
          today: "ሎሚ",
          week: "ዝሓለፈ 7 መዓልታት",
          month: "ዝሓለፈ 30 መዓልታት",
          year: "ዝሓለፈ ዓመት",
          custom: "ናይ ውልቀ እዋን"
        }
      },
      table: {
        date: "ዕለት",
        memberId: "መፍለይ ኣባል (ID)",
        member: "ኣባል",
        amount: " መጠን",
        type: "ዓይነት",
        glCode: "GL ኮድ",
        method: "ገባሪ",
        status: "ኩነታት",
        collectedBy: "ዝኣከቦ",
        receipt: "ቅብሊት",
        notes: "መዘኻኸሪ"
      },
      types: {
        membership_due: "ወርሓዊ ክፍሊት",
        tithe: "asserat (ዓስራት)",
        donation: "ልገሳ",
        event: "በዓል/መረሃ ግብሪ",
        other: "ካልእ"
      },
      methods: {
        cash: "ብጥረ ገንዘብ",
        check: "Check",
        zelle: "Zelle",
        credit_card: "Credit Card",
        debit_card: "Debit Card",
        ach: "ACH",
        other: "ካልእ"
      },
      status: {
        pending: "Pending",
        succeeded: "ተሰዲዱ",
        failed: "ፈሺሉ",
        canceled: "ተሰሪዙ"
      },
      pagination: {
        page: "ገጽ",
        of: "ካብ",
        previous: "ዝሓለፈ",
        next: "ዝቕጽል"
      },
      empty: {
        title: "ዝኾነ ክፍሊት ኣይተረኽበን",
        desc: "በይዘኦም እቲ መጣረዪ የስተኻኽሉ ወይ ሓዱሽ ክፍሊት የእትዉ።"
      }
    },
    expenses: {
      filters: {
        title: "መጣረዪታት",
        startDate: "መጀመሪ ዕለት",
        endDate: "መወዳእታ ዕለት",
        category: "ዓይነት",
        paymentMethod: "ገባሪ ክፍሊት",
        clear: "ኩሉ መጣረዪ አጽሪ",
        allCategories: "ኩሉ ዓይነታት",
        allMethods: "ኩሉ ኣገባባት"
      },
      table: {
        title: "ወጪታት",
        date: "ዕለት",
        category: "ዓይነት",
        payee: "ተቀባሊ",
        amount: "መጠን",
        method: "ኣገባብ",
        checkNumber: "Check #",
        recordedBy: "ዝመዝገቦ",
        memo: "መዘኻኸሪ",
        employee: "ሰራሕተኛ",
        vendor: "ሻያጣይ",
        loading: "ወጪታት የራግብ ኣሎ...",
        empty: "ዝኾነ ወጪ ኣይተረኽበን።"
      },
      addModal: {
        title: "ወጪ ወስኽ",
        amount: "መጠን",
        date: "ክፍሊት ዝተፈጸመሉ ዕለት",
        category: "ዓይነት",
        payeeType: "ዓይነት ተቀባሊ",
        paymentMethod: "ኣገባብ ክፍሊት",
        checkNumber: "Check Number",
        receiptNumber: "ቁጽሪ ቅብሊት",
        memo: "መዘኻኸሪ",
        cancel: "ሰርዝ",
        save: "ወጪ መዝግብ",
        saving: "ይመዝግብ ኣሎ...",
        select: "ምረጽ...",
        types: {
          employee: "ሰራሕተኛ",
          vendor: "ሻያጣይ",
          other: "ካልእ"
        }
      }
    },
    reportTabs: {
      weekly: {
        title: "📅 ሰሙናዊ ጸብጻብ ክፍሊትን ወጪን",
        previous: "ዝሓለፈ ሰሙን",
        next: "ዝቕጽል ሰሙን",
        netDeposit: "💰 ጠቕላላ ዝተረፈ ገንዘብ",
        income: "ጠቕላላ እቶት",
        transactions: "ዝውውራት",
        netToDeposit: "ዝተረፈ ገንዘብ",
        details: "ዝርዝር",
        hide: "ሕባእ",
        show: "ርኣይ",
        empty: "ኣብዚ ሰሙን ዝኾነ ዝውውር የለን"
      },
      paymentReports: {
        type: "ዓይነት ጸብጻብ:",
        generate: "ጸብጻብ ኣውጽእ",
        loading: "ይጽዕን ኣሎ...",
        types: {
          summary: "ሓፈሻዊ ጸብጻብ",
          behind: "ክፍሊት ዝተረፎም",
          monthly: "ወርሓዊ ጸብጻብ"
        },
        summary: {
          totalMembers: "ጠቕላላ ኣባላት",
          upToDate: "እዋናዊ ዝኸፈሉ",
          behind: "ክፍሊት ዝተረፎም",
          collectionRate: "መጠን ኣከባብ ክፍሊት",
          totalDue: "ጠቕላላ ዝተረፈ ክፍሊት",
          totalCollected: "ጠቕላላ ዝተኣከበ"
        },
        behind: {
          title: "ክፍሊት ዝተረፎም ኣባላት",
          member: "ኣባል",
          contact: "ኣድራሻ/ስልክ",
          totalDue: "ክኸፍልዎ ዝግባእ",
          collected: "ዝኸፈሉዎ",
          balance: "ዝተረፈ"
        },
        monthly: {
          title: "ወርሓዊ ጸብጻብ ኣከባብ ክፍሊት",
          totalCollected: "ጠቕላላ ዝተኣከበ"
        }
      }
    }
  },
  admin: {
    dashboard: "ኣድሚን ዳሽቦርድ",
    welcome: "እንኳዕ ብደሓን መጻእኩም",
    manageMembers: "ኣባላት ምምሕዳር",
    roleManagement: "ናይ ስራሕ ሓላፍነት ምምሕዳር",
    departments: "ክፍሊ ስራሕ ሕብረት",
    common: {
      actions: "ተግባራት",
      search: "ድለይ",
      filter: "መምረጺ",
      status: "ኩነታት",
      role: "ሓላፍነት",
      all: "ኩሉ",
      active: "ንጡፍ",
      inactive: "ዘይነጥፍ",
      cancel: "ሰርዝ",
      save: "ቀምጥ",
      loading: "ይጽዕን ኣሎ...",
      retry: "ደጊምካ ፈትን",
      next: "ቀጻሊ",
      previous: "ዝሓለፈ",
      of: "ካብ",
      page: "ገጽ",
      results: "ውጽኢት",
      showing: "ዘርእይ ዘሎ",
      to: "ናብ",
      confirmDelete: "ብርግጽ ክጠፍእ ይደልዩ ድዮም?",
      noData: "ዝተረኽበ ሓበሬታ የለን",
      create: "ፍጠር",
      edit: "ኣስተኻኽል",
      delete: "ሰርዝ",
      update: "ኣሐድስ",
      view: "ርኣይ"
    },
    members: {
      title: "ኣባላት ምምሕዳር",
      addMember: "ሓዱሽ ኣባል ወስኽ",
      addDependent: "ቤተሰብ ወስኽ",
      manageDependents: "ቤተሰብ ኣስተኻኽል",
      stats: {
        totalHouseholds: "ጠቕላላ ስድራቤታት",
        registeredMembers: "ዝተመዝገቡ ኣባላት",
        totalDependents: "ጠቕላላ ተደገፍቲ",
        familyMembers: "ኣባላት ስድራ",
        totalCongregation: "ጠቕላላ ምእመናን",
        householdsAndDependents: "ስድራቤታትን ተደገፍቲን",
        description: "ጠቕላላ ቁጽሪ ማሕበረሰብ ቤተ ክርስቲያን"
      },
      table: {
        name: "ሽም",
        email: "ኢሜይል",
        phone: "ቴሌፎን",
        role: "ሓላፍነት",
        status: "ኩነታት",
        dependents: "ተደገፍቲ"
      }
    },
    roles: {
      title: "ናይ ስራሕ ሓላፍነት ምምሕዳር",
      description: "ናይ ኣባላት ሓላፍነትን ፍቓድን ምምሕዳር",
      stats: {
        members: "ኣባላት"
      },
      updateRole: "ሓላፍነት ኣሐድስ",
      currentRole: "ናይ ሕዚ ሓላፍነት",
      newRole: "ሓዱሽ ሓላፍነት",
      changeRole: "ሓላፍነት ቀይር",
      updatingFor: "ሓላፍነት ዝቕየር ዘሎ ን",
      updating: "ይቕይር ኣሎ..."
    },
    departmentSection: {
      title: "ክፍሊ ስራሕን ስበካን",
      description: "ናይ ቤተ ክርስቲያን ክፍሊ ስራሕን ጉጅለታትን ምምሕዳር",
      create: "ክፍሊ ስራሕ ፍጠር",
      stats: {
        total: "ጠቕላላ ክፍሊ ስራሕ",
        enrolled: "ዝተሳተፉ ኣባላት",
        byType: "ብዓይነት"
      },
      types: {
        ministry: "ስበካ",
        committee: "ኮሚቴ",
        service: "ኣገልግሎት",
        social: "ማሕበራዊ",
        administrative: "ምምሕዳራዊ"
      },
      empty: {
        title: "ዝተረኽበ ክፍሊ ስራሕ የለን",
        action: "ናይ መጀመርታ ክፍሊ ስራሕ ፍጠሩ"
      }
    },
    memberModal: {
      editTitle: "ኣባል ኣስተኻኽል",
      tabs: {
        basic: "መባእታዊ ሓበሬታ",
        contact: "ኣድራሻ",
        spiritual: "መንፈሳዊ ሓበሬታ",
        family: "ሓበሬታ ስድራቤት"
      },
      sections: {
        personal: "ውልቃዊ ዝርዝር",
        address: "ኣድራሻ",
        church: "ዝርዝር ቤተ ክርስቲያን"
      },
      fields: {
        firstName: "ሽም",
        middleName: "ሽም ኣቦ",
        lastName: "ሽም ኣቦሓጎ",
        email: "ኢሜይል",
        phone: "ቁጽሪ ቴሌፎን",
        gender: "ጾታ",
        dob: "ዕለት ልደት",
        maritalStatus: "ኩነታት ሓዳር",
        yearlyPledge: "ዓመታዊ መብጽዓ",
        baptismName: "ሽም ክርስትና",
        role: "ሓላፍነት",
        status: "ኩነታት",
        street: "መንገዲ ኣድራሻ",
        city: "ከተማ",
        state: "ምምሕዳር/State",
        zip: "ፖስታ ቁጽሪ",
        country: "ሃገር",
        joinedParish: "ቤተ ክርስቲያን ዝተጸንበሩሉ ዕለት",
        givingMethod: "ዝመረጽዎ ኣገባብ ወፊ",
        interestedServing: "ንምግልጋል ድሌት ኣለዎም",
        spouseName: "ሽም በዓል/ቲ ቤት",
        spouseEmail: "ኢሜይል በዓል/ቲ ቤት",
        emergencyName: "ተወከስቲ ሓደጋ",
        emergencyPhone: "ቴሌፎን ተወከስቲ ሓደጋ",
        language: "ዝምረጽ ቋንቋ"
      },
      placeholders: {
        selectGender: "ጾታ ይምረጹ",
        selectMaritalStatus: "ኩነታት ሓዳር ይምረጹ",
        selectRole: "ሓላፍነት ይምረጹ",
        selectStatus: "ኩነታት ይምረጹ",
        selectLanguage: "ቋንቋ ይምረጹ",
        selectGivingMethod: "ኣገባብ ወፊ ይምረጹ",
        selectOption: "ይምረጹ"
      },
      options: {
        male: "ወዲ ተባዕታይ",
        female: "ጓል ኣንስተይቲ",
        other: "ካልእ",
        single: "ዘይተመርዓወ/ት",
        married: "ዝተመርዓወ/ት",
        divorced: "ዝተፋትሐ/ት",
        widowed: "በዓል/ቲ ቤቱ/ታ ዝሞቶ/ታ",
        yes: "እወ",
        no: "ኣይኮነን",
        maybe: "ምናልባት",
        cash: "ጥረ ገንዘብ",
        check: "ቼክ",
        online: "ኦንላይን",
        bank_transfer: "ባንክ ምስግጋር",
        active: "ንጡፍ",
        inactive: "ዘይንጡፍ"
      },
      family: {
        linked: "እዚ ኣባል ኣካል ስድራቤት እዩ (መለለዪ ስድራ: {id})። ክፍሊት ብደረጃ ስድራቤት ይተኣኻኸብ።",
        addDependent: "ተደገፍቲ ወስኽ",
        noDependents: "ዛጊድ ዝተወሰኹ ተደገፍቲ የለዉን",
        promote: "ናብ ብቁዕ ኣባልነት ኣሰጋግር"
      },
      actions: {
        save: "ለውጢ ኣቀምጥ",
        saving: "ይቅመጥ ኣሎ...",
        cancel: "ሰርዝ",
        delete: "ሰርዝ",
        edit: "ኣስተኻኽል"
      }
    },
    departmentModal: {
      create: "ክፍሊ ስራሕ ፍጠር",
      edit: "ክፍሊ ስራሕ ኣስተኻኽል",
      manageMembers: "ኣባላት ኣስተኻኽል",
      fields: {
        name: "ሽም ክፍሊ ስራሕ",
        description: "መግለጺ",
        type: "ዓይነት",
        parent: "ላዕለዋይ ክፍሊ ስራሕ",
        leader: "መርሓ/ሒት",
        meetingSchedule: "መደብ ኣኼባ",
        maxMembers: "ዝለዓለ ቁጽሪ ኣባላት",
        public: "ህዝባዊ ክፍሊ ስራሕ",
        active: "ንጡፍ",
        contactEmail: "ናይ ክፍሊ ስራሕ ኢሜይል",
        contactPhone: "ናይ ክፍሊ ስራሕ ቴሌፎን"
      },
      placeholders: {
        searchLeader: "ብሽም፣ መለለዪ ወይ ቴሌፎን ድለ...",
        selectLeader: "መርሓ/ሒት ምረጽ",
        searchMembers: "ብሽም፣ መለለዪ ወይ ቴሌፎን ድለ...",
        none: "የለን (ላዕለዋይ ደረጃ)"
      },
      types: {
        ministry: "ስበካ",
        committee: "ኮሚቴ",
        service: "ኣገልግሎት",
        social: "ማሕበራዊ",
        administrative: "ምምሕዳራዊ"
      },
      members: {
        add: "ኣባላት ወስኽ",
        selectToAdd: "ብምምራጽ ኣባላት ወስኽ",
        current: "ናይ ሕዚ ኣባላት",
        noMembers: "ኣብዚ ክፍሊ ስራሕ ዛጊድ ኣባላት የለዉን",
        allAdded: "ኩሎም ኣባላት ተወሰኹ እዮም",
        noResults: "ዝድለ ኣባል ኣይተረኽበን",
        addSelected: "ዝተመረጹ ወስኽ"
      }

    }
  }
};

// Convenience export for provider lookup
export const dictionaries: Record<Lang, Dictionaries> = { en, ti };