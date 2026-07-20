// Minimal bilingual dictionaries for English (en) and Tigrinya (ti).
// Keys align with the UI components we discussed (SiteHeader, Hero, QuickActions).

export type Lang = 'en' | 'ti';

export interface Dictionaries {
  // Escape hatch for consolidated flat keys (e.g. "admin.panel") migrated from
  // the legacy LanguageContext translations object. Prefer nested keys for new work.
  [key: string]: any;
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
      whatsapp: string;
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
      pageTitle: string;
      yearLabel: string;
      totalReceipts: string;
      ytdBalance: string;
      surplus: string;
      deficit: string;
      annualDuesProgress: string;
      collectedOf: string;
      stillOutstanding: string;
      otherIncome: string;
      currentBalance: string;
      lastUpdated: string;
      balanceNote: string;
      target: string;
      onPace: string;
      onPaceHelp: string;
      pledged: string;
      membershipDues: string;
      otherDonations: string;
      reconcileRequired: string;
      reconcileLedger: string;
      reconcileBank: string;
      reconcileDiff: string;
    };
    health: {
      title: string;
      financialHealth: string;
      duesAndMemberStatus: string;
      activeGivers: string;
      totalMembers: string;
      upToDate: string;
      behind: string;
      fullyPaid: string;
      behindOnDues: string;
      activeMembers: string;
      membershipDues: string;
      otherDonations: string;
    };
    transactionList: {
      filters: {
        memberSearch: string;
        receiptNumber: string;
        paymentType: string;
        paymentMethod: string;
        minAmount: string;
        maxAmount: string;
        dateRange: string;
        startDate: string;
        endDate: string;
        apply: string;
        placeholder: {
          search: string;
          receipt: string;
          minAmount: string;
          maxAmount: string;
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
        transactionId: string;
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
        tigray_hunger_fundraiser: string;
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
          fundraiser: string;
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
      descriptions: Record<string, string>;
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
  outreachDashboard: {
    title: string;
    churchTvView: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    loadingMembers: string;
    noNewMembers: string;
    andFamily: string;
    tvFooterMessage: string;
    pendingWelcomes: string;
    pendingDesc: string;
    refresh: string;
    onboardingQueue: string;
    onboardingDesc: string;
    loadingPending: string;
    allCaughtUp: string;
    tabs: {
      pending: string;
      welcomed: string;
      announcements: string;
    };
    welcomedColumns: {
      memberNumber: string;
      familySize: string;
      dateJoined: string;
      welcomedBy: string;
      welcomeNote: string;
    };
    loadingWelcomed: string;
    noWelcomedMembers: string;
    table: {
      name: string;
      contact: string;
      action: string;
    };
    markWelcomed: string;
    noPermission: string;
    welcomedSuccess: string;
    announcements: {
      tabTitle: string;
      addButton: string;
      editButton: string;
      cancelButton: string;
      statusActive: string;
      statusExpired: string;
      statusCancelled: string;
      filterAll: string;
      titleLabel: string;
      descriptionLabel: string;
      startDateLabel: string;
      endDateLabel: string;
      modalCreateTitle: string;
      modalEditTitle: string;
      saveButton: string;
      confirmCancel: string;
      noAnnouncements: string;
      titleTiLabel: string;
      descriptionTiLabel: string;
      tigrinyaSectionToggle: string;
      columns: {
        title: string;
        dates: string;
        status: string;
        actions: string;
      };
    };
    tvSettings: {
      gearLabel: string;
      intervalLabel: string;
      saveLabel: string;
    };
    addWelcomeNote: {
      title: string;
      for: string;
      summary: string;
      phone: string;
      email: string;
      pledge: string;
      address: string;
      registration: string;
      householdSize: string;
      loadingProfile: string;
      profileUnavailable: string;
      noteLabel: string;
      notePlaceholder: string;
      charMin: string;
      looksGood: string;
      remaining: string;
      cancel: string;
      save: string;
      saving: string;
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
      whatsapp: "Join us on WhatsApp",
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
      collectionProgress: "Collection Progress",
      pageTitle: "Financial Overview",
      yearLabel: "Year",
      totalReceipts: "Total Receipts",
      ytdBalance: "Year-to-Date Balance",
      surplus: "Surplus",
      deficit: "Deficit",
      annualDuesProgress: "Annual Dues Progress",
      collectedOf: "collected of",
      stillOutstanding: "still outstanding",
      otherIncome: "Other Income",
      currentBalance: "Bank Balance",
      lastUpdated: "Updated",
      balanceNote: "Balance reflects all transactions on record, not filtered by year",
      target: "Goal",
      onPace: "On pace",
      onPaceHelp: "Dues collected vs. what's expected by this point in the year (partial payments count). Can exceed 100% when members pay ahead.",
      pledged: "pledged",
      membershipDues: "Membership Dues",
      otherDonations: "Other Donations",
      reconcileRequired: "Doesn't match the bank statement — reconciliation required",
      reconcileLedger: "Ledger",
      reconcileBank: "Bank",
      reconcileDiff: "Difference",
    },
    health: {
      title: "Membership Health",
      financialHealth: "Financial Health",
      duesAndMemberStatus: "Dues & Member Status",
      activeGivers: "Active Givers",
      totalMembers: "of {count} members",
      upToDate: "Up to Date",
      behind: "Behind",
      fullyPaid: "Fully Paid",
      behindOnDues: "Behind on Dues",
      activeMembers: "Active Members",
      membershipDues: "Membership Dues",
      otherDonations: "Other Donations",
    },
    transactionList: {
      filters: {
        memberSearch: "Member Search",
        receiptNumber: "Receipt Number",
        paymentType: "Payment Type",
        paymentMethod: "Payment Method",
        minAmount: "Min Amount",
        maxAmount: "Max Amount",
        dateRange: "Date Range",
        startDate: "Start Date",
        endDate: "End Date",
        apply: "Apply Filters",
        placeholder: {
          search: "Search member (min 3 chars)...",
          receipt: "Search receipt #...",
          minAmount: "Minimum amount",
          maxAmount: "Maximum amount"
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
        transactionId: "Transaction ID",
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
        tigray_hunger_fundraiser: "Tigray Hunger Fundraiser",
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
          monthly: "Monthly Breakdown",
          fundraiser: "Tigray Hunger Fundraiser"
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
      descriptions: {
        admin: "Full system access. Can manage users, roles, system settings, and all data.",
        church_leadership: "Oversight access. Can view most data, approve budgets, and manage events.",
        treasurer: "Full financial authority. Can manage all income, expenses, and reports.",
        secretary: "Administrative support. Can manage member records and communications.",
        bookkeeper: "Financial operations. Can record day-to-day income/expenses and reconcile banks.",
        budget_committee: "Financial planning. Can view data and approve budgets (read-only transactions).",
        auditor: "Financial oversight. Strict read-only access to all financial records and logs.",
        ar_team: "Accounts Receivable. Can record donations/income. No expense access.",
        ap_team: "Accounts Payable. Can record expenses/vendor payments. No income access.",
        relationship: "Outreach & Care. Can manage member follow-ups and notes.",
        member: "Standard access. Can view own profile and make donations."
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
  outreachDashboard: {
    title: "Outreach & Member Relations",
    churchTvView: "Church TV View",
    welcomeTitle: "Welcome to Our Church Family!",
    welcomeSubtitle: "We are blessed to have you with us.",
    loadingMembers: "Loading new members...",
    noNewMembers: "No new members to welcome at this time.",
    andFamily: "and Family",
    tvFooterMessage: "New members, please meet our outreach committee at the bottom floor after church service.",
    pendingWelcomes: "Pending Welcomes",
    pendingDesc: "Members who registered but haven't been welcomed yet.",
    refresh: "Refresh",
    onboardingQueue: "Onboarding Queue",
    onboardingDesc: "Mark a member as welcomed after contact is made.",
    loadingPending: "Loading pending members…",
    allCaughtUp: "All caught up! No pending welcomes.",
    tabs: {
      pending: "Pending Welcomes",
      welcomed: "Already Welcomed",
      announcements: "Public Announcements"
    },
    welcomedColumns: {
      memberNumber: "Member ID",
      familySize: "Family Size",
      dateJoined: "Date Joined",
      welcomedBy: "Welcomed By",
      welcomeNote: "Welcome Note"
    },
    loadingWelcomed: "Loading welcomed members…",
    noWelcomedMembers: "No welcomed members found.",
    table: {
      name: "Name",
      contact: "Contact",
      action: "Action"
    },
    markWelcomed: "Mark Welcomed",
    noPermission: "No permission",
    welcomedSuccess: "Welcomed note saved and member marked welcomed.",
    announcements: {
      tabTitle: "Public Announcements",
      addButton: "Add Announcement",
      editButton: "Edit",
      cancelButton: "Cancel Announcement",
      statusActive: "Active",
      statusExpired: "Expired",
      statusCancelled: "Cancelled",
      filterAll: "All",
      titleLabel: "Title",
      descriptionLabel: "Description",
      startDateLabel: "Start Date",
      endDateLabel: "End Date",
      modalCreateTitle: "New Announcement",
      modalEditTitle: "Edit Announcement",
      saveButton: "Save",
      confirmCancel: "Cancel this announcement? This cannot be undone.",
      noAnnouncements: "No announcements found.",
      titleTiLabel: "Title (Tigrinya)",
      descriptionTiLabel: "Description (Tigrinya)",
      tigrinyaSectionToggle: "Add Tigrinya Translation",
      columns: {
        title: "Title",
        dates: "Date Range",
        status: "Status",
        actions: "Actions"
      }
    },
    tvSettings: {
      gearLabel: "TV Settings",
      intervalLabel: "Rotate every (seconds)",
      saveLabel: "Save"
    },
    addWelcomeNote: {
      title: "Add Welcome Note",
      for: "for",
      summary: "Member Summary",
      phone: "Phone:",
      email: "Email:",
      pledge: "Yearly Pledge:",
      address: "Address:",
      registration: "Registration:",
      householdSize: "Household Size:",
      loadingProfile: "Loading profile…",
      profileUnavailable: "Profile unavailable",
      noteLabel: "Note (1–2000 characters)",
      notePlaceholder: "Please note your greeting and pastoral conversation. For example: asked about their family and household details, when they moved to the Dallas–DFW area, and gently invited them to consider a yearly membership pledge as the Lord provides.",
      charMin: "Enter at least 3 characters",
      looksGood: "Looks good",
      remaining: "remaining",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving…"
    }
  },

  // ==== Consolidated legacy flat keys (Phase 1 migration from LanguageContext) ====
  "admin.panel": "Admin Panel",
  "manage.members": "Manage Members",
  "manage.members.and.roles": "Manage members and roles",
  "access.admin.panel": "Access Admin Panel",
  "role.management": "Role Management",
  "manage.member.roles.and.permissions": "Manage member roles and permissions",
  "update.member.roles": "Update Member Roles",
  "change.role": "Change Role",
  "new.role": "New Role",
  "current.role": "Current Role",
  "role.descriptions": "Role Descriptions",
  "update.role": "Update Role",
  "updating.role.for": "Updating role for",
  "new.permissions": "New Permissions",
  "updating": "Updating...",
  "statistics": "Statistics",
  "overview.of.church.membership": "Overview of church membership",
  "active.members": "Active Members",
  "total.children": "Total Children",
  "recent.registrations": "Recent Registrations",
  "role.breakdown": "Role Breakdown",
  "gender.breakdown": "Gender Breakdown",
  "marital.status.breakdown": "Marital Status Breakdown",
  "language.preference.breakdown": "Language Preference Breakdown",
  "membership.status": "Membership Status",
  "members.with.children": "Members with Children",
  "activity.metrics": "Activity Metrics",
  "new.registrations.30.days": "New Registrations (30 days)",
  "avg.children.per.family": "Avg Children per Family",
  "active.rate": "Active Rate",
  "quick.actions": "Quick Actions",
  "export.member.list": "Export Member List",
  "generate.report": "Generate Report",
  "send.communication": "Send Communication",
  "refresh.statistics": "Refresh Statistics",
  "no.data.available": "No data available",
  "edit.member": "Edit Member",
  "search": "Search",
  "all.roles": "All Roles",
  "all.statuses": "All Statuses",
  "active": "Active",
  "inactive": "Inactive",
  "joined": "Joined",
  "children": "Children",
  "current.permissions": "Current Permissions",
  "confirm.delete.member": "Are you sure you want to delete this member?",
  "basic.info": "Basic Information",
  "contact.info": "Contact Information",
  "street.address": "Street Address",
  "ministries": "Ministries",
  "ministries.placeholder": "List ministries you are interested in...",
  "bank_transfer": "Bank Transfer",
  "select.language": "Select language",
  "english": "English",
  "tigrinya": "Tigrinya",
  "amharic": "Amharic",
  "no.children.registered": "No children registered",
  "spiritual.father": "Spiritual Father",
  "contact.address": "Contact & Address",
  "common.edit": "Edit",
  "common.delete": "Delete",

  // ==== Shared: Gregorian month short names ====
  months: {
    short: {
      january: "Jan", february: "Feb", march: "Mar", april: "Apr",
      may: "May", june: "Jun", july: "Jul", august: "Aug",
      september: "Sep", october: "Oct", november: "Nov", december: "Dec"
    }
  },

  // ==== DuesPage (Phase 2a) ====
  duesPage: {
    signInRequired: "You must be signed in to view dues.",
    dependentNotLinked: "Your dependent profile is not linked to a head of household yet. Please contact the head to link your profile or use the self-claim flow.",
    loadFailed: "Failed to load dues",
    statementFailed: "Failed to generate statement",
    retry: "Retry",
    title: "Member Dues",
    calculatedFrom: "Calculated from parish join date",
    monthlyStatus: "Monthly Status",
    dueShort: "Due",
    monthlyCommitment: "Monthly commitment:",
    paymentHistory: "Payment History",
    noPayments: "No payments found for this year.",
    stat: {
      collected: "Collected",
      balanceDue: "Balance Due",
      otherPayments: "Other Payments",
      yearlyPledge: "Yearly Pledge"
    },
    col: {
      date: "Date",
      amount: "Amount",
      type: "Type",
      method: "Method",
      receipt: "Receipt #",
      note: "Note",
      status: "Status"
    },
    status: {
      pending: "Pending",
      succeeded: "Succeeded"
    },
    statement: {
      title: "Annual Contribution Statement",
      desc: "Generate your tax-deductible contribution statement for {year}.",
      print: "Print Statement"
    }
  },

  // ==== DonatePage (Phase 2a) ====
  donatePage: {
    title: "Support Our Church",
    subtitle: "Your generous donation helps us continue our mission and serve our community.",
    onlineDonation: "Online Donation",
    howOften: "How often would you like to donate?",
    oneTime: "One-Time",
    recurring: "Recurring",
    frequency: "Frequency",
    donationAmount: "Donation Amount",
    paymentMethod: "Payment Method",
    cardOption: "Credit/Debit Card",
    achOption: "Bank Account (ACH)",
    cardInformation: "Card Information",
    bankInformation: "Bank Account Information",
    donorInformation: "Donor Information",
    prefillNoteLabel: "Note:",
    prefillNoteBody: "Your information has been prefilled from your profile. You can update any fields if needed.",
    resetToProfile: "Reset to Profile",
    firstName: "First Name *",
    lastName: "Last Name *",
    email: "Email",
    phoneNumber: "Phone Number",
    billingAddress: "Billing Address",
    zipCode: "Zip Code",
    processing: "Processing...",
    continueToPayment: "Continue to Payment - ${amount}",
    paymentSuccessMsg: "Payment successful! Thank you for your donation.",
    freq: {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly"
    },
    errors: {
      amountDecimals: "Enter a valid amount (numbers only, up to 2 decimals).",
      amountDecimalsAlert: "Please enter a valid amount (numbers only, up to 2 decimals).",
      amountExample: "Please enter a valid amount (e.g., 10 or 10.00)",
      amountMin: "Minimum amount is $1.00",
      amountMinAlert: "Please enter a valid amount (minimum $1.00)",
      nameRequired: "Please fill in your first and last name",
      cardNotReady: "Card payment processing is not ready. Please try again.",
      achNotReady: "ACH payment processing is not ready. Please try again.",
      unexpected: "An unexpected error occurred"
    },
    thankYou: "Thank you for your donation of ${amount}! Your payment has been processed successfully.",
    auth: {
      template: "I authorize this merchant or their agent to {action} in the amount above {recurring} as soon as I click the \"Continue to Payment\" button below. I agree that {method} transactions I authorize comply with all applicable law.",
      chargeCard: "charge my credit card",
      debitAccount: "debit my account",
      recurringClause: "via {frequency} recurring payments",
      methodCard: "credit card",
      methodAch: "ACH"
    },
    zelle: {
      title: "Donate via Zelle",
      qrAlt: "Zelle QR code for Abune Aregawi Church",
      imageFallbackPre: "If the image does not load, ",
      imageFallbackLink: "open the QR code",
      scanHint: "Scan this QR code in your banking app to donate via Zelle.",
      emailLabel: "Zelle Email Address:",
      copyTitle: "Click to copy email address",
      howTitle: "How to donate via Zelle:",
      step1: "Open your banking app or Zelle app",
      step2: "Select \"Send Money\" or \"Send with Zelle\"",
      step3: "Enter the email address:",
      step4: "Enter your donation amount",
      step5Pre: "Add a memo/note: ",
      step5Memo: "\"[Your Phone Number] for [reason]\"",
      step5Hint: "Please include your phone number for proper tracking.",
      step6: "Review and send your payment",
      quickCopyLabel: "✅ Quick Copy:",
      quickCopyBody: "Click the email address above to copy it to your clipboard, then paste it directly into your Zelle app."
    },
    check: {
      title: "Donate by Check",
      payableTo: "Make checks payable to:",
      payee: "Abune Aregawi Orthodox Tewahedo Church"
    },
    questions: {
      title: "Questions?",
      body: "For questions about donations, please contact us:"
    }
  },

  // ==== DependentsManagement (Phase 2a) ====
  dependentsPage: {
    loading: "Loading dependents...",
    title: "Spouse & Dependents",
    add: "Add Dependent",
    householdRecord: "Household Record",
    managedUnderPre: "This family record is managed under ",
    managedUnderPost: ".",
    dependentNote: " You can review the household here, but family updates should be handled by the head of household.",
    headNote: " You can review and update the spouse and children linked to this household from this page.",
    editTitle: "Edit Dependent",
    addTitle: "Add New Dependent",
    firstName: "First Name *",
    middleName: "Middle Name",
    lastName: "Last Name *",
    dob: "Date of Birth",
    optional: "Optional",
    gender: "Gender *",
    male: "Male",
    female: "Female",
    relationship: "Relationship",
    selectRelationship: "Select Relationship",
    phone: "Phone",
    email: "Email",
    baptismName: "Baptism Name",
    isBaptized: "Is Baptized",
    cancel: "Cancel",
    update: "Update Dependent",
    noneYet: "No dependents added yet.",
    getStarted: "Click \"Add Dependent\" to get started.",
    yes: "Yes",
    no: "No",
    edit: "Edit",
    delete: "Delete",
    col: {
      name: "Name",
      dob: "Date of Birth",
      gender: "Gender",
      relationship: "Relationship",
      baptismName: "Baptism Name",
      baptized: "Baptized",
      actions: "Actions"
    },
    errors: {
      prefix: "Error:",
      notAuthenticated: "Not authenticated",
      profileFailed: "Failed to get member profile",
      resolveIdFailed: "Could not resolve member ID",
      saveError: "Error saving dependent information",
      deleteConfirm: "Are you sure you want to delete this dependent?",
      deleteError: "Error deleting dependent"
    }
  },

  // ==== PledgeForm (Phase 2a) ====
  pledgeForm: {
    title: "Make a Pledge",
    subtitle: "Support our church with your generous pledge",
    selectMember: "Select Member (Optional)",
    searchPlaceholder: "Search by name or phone",
    searchAria: "Search members by name or phone",
    loadingMembers: "Loading members...",
    selectMatched: "Select a matched member or clear to show all",
    selectExisting: "Select existing member or leave blank for new",
    noMatches: "No matches",
    noMembers: "No members found",
    clearSelection: "Clear selection to enter new member info",
    eventName: "Event Name *",
    eventNamePlaceholder: "e.g., Sunday Fundraising Event",
    amount: "Pledge Amount *",
    customAmountPlaceholder: "Enter custom amount",
    firstName: "First Name *",
    lastName: "Last Name *",
    email: "Email",
    phone: "Phone",
    autoFilledTitle: "Auto-filled from selected member",
    autoFilledPlaceholder: "Auto-filled from member",
    address: "Address",
    autoFilledParen: "(Auto-filled from member)",
    optionalParen: "(Optional)",
    streetPlaceholder: "Street address",
    addressModifyHint: "Address from selected member - you can modify if needed",
    zip: "ZIP Code",
    notes: "Notes (Optional)",
    notesPlaceholder: "Any additional notes or dedication...",
    processing: "Processing...",
    submit: "Pledge ${amount}",
    errors: {
      amountMin: "Amount must be at least $1.00",
      firstNameRequired: "First name is required",
      lastNameRequired: "Last name is required",
      emailInvalid: "Please enter a valid email address",
      phoneRequired: "Phone number is required for new members"
    }
  },

  // ==== PledgeTracker (Phase 2a) ====
  pledgeTracker: {
    loadFailed: "Failed to load pledge statistics",
    tryAgain: "Try Again",
    noData: "No pledge data available",
    eventPledges: "{event} Pledges",
    title: "Pledge Tracker",
    subtitle: "See how our Abune Aregawi church community is coming together to support this cause.",
    refresh: "Refresh",
    totalPledged: "Total Pledged",
    totalDonated: "Total Donated",
    remaining: "Remaining",
    fulfillmentProgress: "Fulfillment Progress",
    pledgeStatus: "Pledge Status",
    totalAmount: "Total Amount",
    anonymous: "Anonymous",
    lastUpdated: "Last updated: {time}"
  },

  // ==== ACHPayment (Phase 2a) ====
  achPayment: {
    bankInfo: "Bank Account Information",
    accountHolderName: "Account Holder Name *",
    routingNumber: "Routing Number *",
    routingHint: "The 9-digit routing number found on your checks",
    accountNumber: "Account Number *",
    accountNumberHint: "Your bank account number",
    accountType: "Account Type *",
    checking: "Checking",
    savings: "Savings",
    amountLabel: "Amount:",
    typeLabel: "Type:",
    recurring: "Recurring",
    oneTime: "One-time",
    methodLabel: "Payment Method:",
    methodValue: "Bank Account (ACH)",
    importantLabel: "Important:",
    importantText: "ACH payments typically take 3-5 business days to process. You will receive a confirmation email once the payment is processed.",
    securityLabel: "Security:",
    securityText: "Your bank account information is encrypted and securely processed. We do not store your account details on our servers.",
    cancel: "Cancel",
    processing: "Processing...",
    pay: "Pay ${amount}",
    errors: {
      stripeNotLoaded: "Stripe has not loaded yet. Please try again.",
      fillRequired: "Please fill in all required bank account information.",
      routingLength: "Routing number must be 9 digits.",
      accountLength: "Account number must be at least 4 digits.",
      achFailed: "ACH confirmation failed",
      unexpected: "An unexpected error occurred"
    }
  },

  // ==== StripePayment (Phase 2a) ====
  stripePayment: {
    cardInformation: "Card Information",
    cardAriaLabel: "Credit or debit card information",
    nameOnCard: "Name on card",
    nameOnCardPlaceholder: "Full name as shown on card",
    paymentInformation: "Payment Information",
    errors: {
      paymentFailed: "Payment failed",
      notSuccessful: "Payment was not successful. Please try again."
    }
  },

  // ==== Batch 2b: Departments & Meetings ====
  // -- DepartmentsPage (listing / browse) --
  "departmentsPage.backToDashboard": "Back to Dashboard",
  "departmentsPage.title": "Departments & Service",
  "departmentsPage.subtitle": "View your departments or explore opportunities to serve",
  "departmentsPage.myTab": "My Departments",
  "departmentsPage.browseTab": "Browse All",
  "departmentsPage.members": "members",
  "departmentsPage.viewDetails": "View Details",
  "departmentsPage.requestToJoin": "Request to Join",
  "departmentsPage.requestComingSoon": "Request to join functionality coming soon!",
  "departmentsPage.emptyMyTitle": "No Departments Found",
  "departmentsPage.emptyAllTitle": "No Departments Available",
  "departmentsPage.emptyMyDesc": "You haven't joined any departments yet. Browse the full list to find where you can serve.",
  "departmentsPage.emptyAllDesc": "There are currently no active departments to join.",
  "departmentsPage.browseDepartments": "Browse Departments",

  // -- Department type labels (data enum) --
  "departmentType.ministry": "Ministry",
  "departmentType.committee": "Committee",
  "departmentType.service": "Service",
  "departmentType.social": "Social",
  "departmentType.administrative": "Administrative",

  // -- DepartmentDashboard (migrated from legacy + new) --
  "department.tabs.meetings": "Meetings",
  "department.tabs.tasks": "Tasks",
  "department.tabs.members": "Members",
  "department.addMeeting": "Add Meeting",
  "department.addTask": "Add Task",
  "department.manageMembers": "Manage Members",
  "department.backToDashboard": "Back to Dashboard",
  "department.notFound": "Department not found",
  "department.loadFailed": "Failed to fetch department",
  "department.leader": "Leader:",
  "department.roleMember": "Member",
  "department.noMembers": "No members yet",
  "department.attendees": "attendees",
  "department.noMeetings": "No meetings recorded yet",
  "department.createFirstMeeting": "Create your first meeting",
  "department.due": "Due:",
  "department.edit": "Edit",
  "department.noTasks": "No tasks yet",

  // -- Task status / priority labels (data enums) --
  "taskStatus.pending": "Not Started",
  "taskStatus.in_progress": "In Progress",
  "taskStatus.completed": "Completed",
  "taskStatus.cancelled": "Cancelled",
  "taskStatus.rejected": "Rejected",
  "taskPriority.low": "Low",
  "taskPriority.medium": "Medium",
  "taskPriority.high": "High",
  "taskPriority.urgent": "Urgent",

  // -- AddMeetingModal --
  "meetingModal.editTitle": "Edit Meeting",
  "meetingModal.createTitle": "Schedule New Meeting",
  "meetingModal.keyboard": "Keyboard:",
  "meetingModal.englishLatin": "English (Latin)",
  "meetingModal.title": "Meeting Title",
  "meetingModal.dateTime": "Date & Time",
  "meetingModal.location": "Location",
  "meetingModal.purpose": "Purpose",
  "meetingModal.agenda": "Agenda",
  "meetingModal.attendees": "Attendees",
  "meetingModal.notes": "Meeting Notes / Minutes",
  "meetingModal.cancel": "Cancel",
  "meetingModal.saving": "Saving...",
  "meetingModal.update": "Update Meeting",
  "meetingModal.create": "Create Meeting",
  "meetingModal.saveFailed": "Failed to save meeting",
  "meetingModal.genericError": "An error occurred",

  // -- AddTaskModal --
  "taskModal.editTitle": "Edit Task",
  "taskModal.createTitle": "Create New Task",
  "taskModal.objective": "Objective",
  "taskModal.objectivePlaceholder": "Brief description of the task",
  "taskModal.description": "Description",
  "taskModal.descriptionPlaceholder": "Detailed description...",
  "taskModal.status": "Status",
  "taskModal.priority": "Priority",
  "taskModal.assignedTo": "Assigned To",
  "taskModal.unassigned": "Unassigned",
  "taskModal.startDate": "Start Date",
  "taskModal.endDate": "End Date",
  "taskModal.rejectedDate": "Rejected Date",
  "taskModal.notes": "Notes",
  "taskModal.notesPlaceholder": "Additional notes...",
  "taskModal.cancel": "Cancel",
  "taskModal.saving": "Saving...",
  "taskModal.update": "Update Task",
  "taskModal.create": "Create Task",
  "taskModal.rejectedDateRequired": "Rejected date is required when status is rejected",
  "taskModal.saveFailed": "Failed to save task",
  "taskModal.genericError": "An error occurred",

  // -- MeetingDetailsPage / MeetingEmailModal (migrated from legacy + new) --
  "meeting.tasks.previous": "Tasks from Previous Meeting",
  "meeting.tasks.actionItems": "Action Items from This Meeting",
  "meeting.tasks.add": "Add Task",
  "meeting.tasks.none": "No action items yet",
  "meeting.agenda": "Agenda",
  "meeting.minutes": "Meeting Notes",
  "meeting.attendees": "Attendees",
  "meeting.assignedTo": "Assigned to",
  "meeting.due": "Due",
  "meeting.notFound": "Meeting not found",
  "meeting.loadFailed": "Failed to fetch meeting",
  "meeting.backToDepartment": "Back to Department",
  "meeting.editMeeting": "Edit meeting",
  "meeting.editTask": "Edit task",
  "meeting.print.savePdf": "Print / Save PDF",
  "meeting.print.record": "Meeting Record",
  "meeting.print.overview": "Meeting Overview",
  "meeting.print.department": "Department",
  "meeting.print.date": "Date",
  "meeting.print.location": "Location",
  "meeting.print.purpose": "Purpose",
  "meeting.print.generated": "Generated",
  "meeting.print.language.english": "English",
  "meeting.print.language.tigrinya": "Tigrinya",
  "meeting.print.notProvided": "Not provided",
  "meeting.print.noAttendees": "No attendees recorded",
  "meeting.email.button": "Email Members",
  "meeting.email.modalTitle": "Email Meeting Minutes",
  "meeting.email.recipients": "Recipients",
  "meeting.email.skipped": "Skipped",
  "meeting.email.subject": "Subject",
  "meeting.email.body": "Message",
  "meeting.email.send": "Send Email",
  "meeting.email.sending": "Sending...",
  "meeting.email.cancel": "Cancel",
  "meeting.email.noRecipients": "No active department members have a valid email address.",
  "meeting.email.previewFailed": "Failed to load email preview",
  "meeting.email.loadingPreview": "Loading email preview…",
  "meeting.email.sendFailed": "Failed to send meeting email",
  "meeting.email.sentSummary": "Members without a valid email were skipped.",
  "meeting.email.reason.missing": "No email on file",
  "meeting.email.reason.invalid": "Invalid email address",

  // ==== Batch 2d (wave A): misc / auth small components ====
  "creditsPage.title": "Tech Team / Credits",

  "parishPulse.title": "Parish Pulse Sign-Up",
  "parishPulse.description": "Sign up to receive important SMS messages and updates from our parish. You can opt out at any time by replying \"STOP\" to any message.",
  "parishPulse.thankYou": "Thank you for signing up! You will receive SMS updates soon.",
  "parishPulse.errorRequired": "Please enter your name and mobile number.",
  "parishPulse.fullName": "Full Name",
  "parishPulse.namePlaceholder": "Your Name",
  "parishPulse.mobileNumber": "Mobile Number",
  "parishPulse.phonePlaceholder": "e.g. (555) 123-4567",
  "parishPulse.submit": "Sign Up",
  "parishPulse.disclaimer": "By submitting your mobile number, you agree to receive SMS messages from Tigray Orthodox Church. Message & data rates may apply. Reply STOP to unsubscribe.",

  "protectedRoute.retry": "Retry",
  "protectedRoute.goToRegistration": "Go to Registration",

  "liveEmbed.liveStream": "Live Stream",
  "liveEmbed.unmute": "Unmute",
  "liveEmbed.mute": "Mute",
  "liveEmbed.unmuteAria": "Unmute live stream",
  "liveEmbed.muteAria": "Mute live stream",
  "liveEmbed.fallbackPrefix": "If the stream doesn’t start automatically, ",
  "liveEmbed.openOnYouTube": "open the live page on YouTube",

  "transliterationHelp.title": "Ge'ez Transliteration Guide",
  "transliterationHelp.instruction": "Type the Latin characters to get the corresponding Ge'ez symbol.",
  "transliterationHelp.close": "Close",

  // ==== Batch 2d: RegistrationSteps (remaining hardcoded strings) ====
  "registration.emailExists": "A member with this email already exists. You may still proceed.",
  "registration.yearlyPledgeLabel": "Yearly Membership Pledge (USD)",
  "registration.yearlyPledgePlaceholder": "e.g. 1200",
  "registration.yearlyPledgeHelp": "This helps us set your monthly dues and track payments.",
  "registration.selectRelationship": "Select Relationship",

  // ==== Batch 2c: admin / finance ====
  // -- BankUpload --
  "bankUpload.title": "Upload Bank Statement",
  "bankUpload.selectFile": "Select Chase CSV File",
  "bankUpload.uploading": "Uploading...",
  "bankUpload.upload": "Upload & Process",
  "bankUpload.uploadFailed": "Upload failed",
  "bankUpload.success": "Upload Successful!",
  "bankUpload.imported": "Imported: {count} new transactions",
  "bankUpload.skipped": "Skipped: {count} duplicates",
  "bankUpload.autoReconciled": "Auto-reconciled: {count} of {examined} pending",
  "bankUpload.autoLinked": "Linked to existing payments (e.g. Zelle automation): {count}",
  "bankUpload.autoMember": "Member payments created from learned payers: {count}",
  "bankUpload.autoExpense": "Expenses recorded from learned payees: {count}",
  "bankUpload.needsReview": "Left for review: {count}",
  "bankUpload.errors": "Errors: {count}",
  "bankUpload.supportedFormat": "Supported format: Chase Activity CSV. System automatically detects Zelle donors and skips duplicate transactions.",
  "bankUpload.autoDeferred": "Large import: automatic reconciliation was skipped to keep the upload fast. Use the \"Auto-reconcile pending\" button in Bank Transactions to run it.",

  // -- Bank transactions: on-demand auto-reconcile --
  "bankTransactions.autoReconcile": "Auto-reconcile pending",
  "bankTransactions.autoReconciling": "Auto-reconciling…",
  "bankTransactions.autoReconcileHelp": "Re-check all pending transactions against known payers, payees, and Zelle references. Runs in bounded batches.",
  "bankTransactions.autoReconcileDone": "Examined {examined} pending transactions; {matched} matched or recorded automatically.",
  "bankTransactions.autoReconcileFailed": "Auto-reconcile failed",

  // -- Member Information report (Payment Reports tab) --
  "memberInfoReport.type": "Member Information",
  "memberInfoReport.title": "Member Information Report",
  "memberInfoReport.generated": "Generated",
  "memberInfoReport.activeMembers": "Active members",
  "memberInfoReport.colId": "ID",
  "memberInfoReport.colFirstName": "First Name",
  "memberInfoReport.colLastName": "Last Name",
  "memberInfoReport.colPhone": "Phone",
  "memberInfoReport.colSpouseFirst": "Spouse First",
  "memberInfoReport.colSpouseLast": "Spouse Last",
  "memberInfoReport.colSpousePhone": "Spouse Phone",

  // -- Admin Member Reports tab --
  "memberReports.tab": "Reports",
  "memberReports.selectLabel": "Report",
  "memberReports.memberInformation": "Member Information",
  "memberReports.householdDirectory": "Household Membership Directory",

  // -- Household Membership Directory report --
  "householdReport.title": "Household Membership Directory",
  "householdReport.sortBy": "Sort by",
  "householdReport.sortLastName": "Last name",
  "householdReport.sortFirstName": "First name",
  "householdReport.savePdf": "Save as PDF",
  "householdReport.summaryTitle": "Membership Summary",
  "householdReport.totalFamilies": "Total Families",
  "householdReport.totalParishMembers": "Total Parish Members",
  "householdReport.totalHeads": "Heads of Household",
  "householdReport.totalSpouses": "Spouses",
  "householdReport.totalDependents": "Dependents",
  "householdReport.generatedOn": "Generated on",
  "householdReport.generatedBy": "Generated by",
  "householdReport.headOfHousehold": "Head of Household",
  "householdReport.spouse": "Spouse",
  "householdReport.dependentsSection": "Dependents",
  "householdReport.householdMembers": "Household Members",
  "householdReport.mobile": "Mobile",
  "householdReport.memberId": "Member ID",
  "householdReport.noResults": "No households found.",
  "householdReport.page": "Page",
  "householdReport.of": "of",
  "householdReport.previous": "Previous",
  "householdReport.next": "Next",

  // -- MonthlyBankSummary --
  "monthlyBankSummary.title": "Monthly Summary",
  "monthlyBankSummary.subtitle": "Income and expenses from bank activity, last {count} months",
  "monthlyBankSummary.showLast6": "Show last 6 months",
  "monthlyBankSummary.showLast12": "Show last 12 months",
  "monthlyBankSummary.colMonth": "Month",
  "monthlyBankSummary.colIncome": "Total Income",
  "monthlyBankSummary.colExpense": "Total Expense",
  "monthlyBankSummary.colNet": "Net Surplus/(Deficit)",
  "monthlyBankSummary.colBalance": "Ending Balance",
  "monthlyBankSummary.colStatus": "Status",
  "monthlyBankSummary.loading": "Loading...",
  "monthlyBankSummary.empty": "No bank activity in the last 12 months. Upload a bank statement to get started.",
  "monthlyBankSummary.reconciled": "Reconciled",
  "monthlyBankSummary.pending": "{count} pending",
  "monthlyBankSummary.awaitingReview": "{pending} of {total} transactions awaiting review",

  // -- ActivityLogViewer --
  "activityLog.loadFailed": "Failed to load activity logs",
  "activityLog.title": "Activity Logs",
  "activityLog.allActions": "All Actions",
  "activityLog.allTypes": "All Types",
  "activityLog.entityMember": "Member",
  "activityLog.entityDonation": "Donation",
  "activityLog.entityPayment": "Payment",
  "activityLog.refresh": "Refresh",
  "activityLog.loading": "Loading logs...",
  "activityLog.colDate": "Date",
  "activityLog.colUser": "User",
  "activityLog.colAction": "Action",
  "activityLog.colEntity": "Entity",
  "activityLog.colDetails": "Details",
  "activityLog.empty": "No activity logs found.",
  "activityLog.systemUnknown": "System / Unknown",
  "activityLog.pageOf": "Page {page} of {total}",
  "activityLog.previous": "Previous",
  "activityLog.next": "Next",

  // -- MemberSearch --
  "memberSearch.title": "Search Members",
  "memberSearch.subtitle": "Select a member to view their dues and payment history",
  "memberSearch.placeholder": "Search by name, email, phone, or member ID...",
  "memberSearch.loading": "Loading members...",
  "memberSearch.noMembersTitle": "No members found",
  "memberSearch.adjustSearch": "Try adjusting your search terms.",
  "memberSearch.noneAvailable": "No members available.",
  "memberSearch.noPledge": "No Pledge",
  "memberSearch.perYear": "/year",
  "memberSearch.found": "{count} members found",
  "memberSearch.cancel": "Cancel",

  // -- PaymentList --
  "paymentList.searchLabel": "Search Members",
  "paymentList.searchPlaceholder": "Search by name or member ID...",
  "paymentList.statusFilter": "Status Filter",
  "paymentList.filterAll": "All Members",
  "paymentList.filterUpToDate": "Up to Date",
  "paymentList.filterBehind": "Behind on Payments",
  "paymentList.filterPartial": "Partial Payments",
  "paymentList.applyFilters": "Apply Filters",
  "paymentList.colMember": "Member",
  "paymentList.colContact": "Contact",
  "paymentList.colMonthly": "Monthly Payment",
  "paymentList.colTotalDue": "Total Due",
  "paymentList.colCollected": "Collected",
  "paymentList.colBalance": "Balance",
  "paymentList.colStatus": "Status",
  "paymentList.spouse": "Spouse:",
  "paymentList.statusNoDues": "No Dues",
  "paymentList.statusUpToDate": "Up to Date",
  "paymentList.statusPartial": "Partial",
  "paymentList.statusBehind": "Behind",
  "paymentList.pageOf": "Page {page} of {total}",
  "paymentList.previous": "Previous",
  "paymentList.next": "Next",

  // -- LoansPage --
  "loansPage.statOutstanding": "Total Outstanding",
  "loansPage.statActive": "Active Loans",
  "loansPage.statPartial": "Partially Repaid",
  "loansPage.statLoaned": "Total Loaned",
  "loansPage.recordLoan": "Record Loan",
  "loansPage.allStatuses": "All Statuses",
  "loansPage.statusActive": "Active",
  "loansPage.statusPartiallyRepaid": "Partially Repaid",
  "loansPage.statusClosed": "Closed",
  "loansPage.startDate": "Start Date",
  "loansPage.endDate": "End Date",
  "loansPage.loanCount": "{count} loan(s)",
  "loansPage.warning": "These are liability records — loans from members. They are NOT donations and NOT tax-deductible.",
  "loansPage.colMember": "Member",
  "loansPage.colLoanDate": "Loan Date",
  "loansPage.colOriginal": "Original Amount",
  "loansPage.colOutstanding": "Outstanding",
  "loansPage.colStatus": "Status",
  "loansPage.colMethod": "Payment Method",
  "loansPage.colReceipt": "Receipt #",
  "loansPage.colActions": "Actions",
  "loansPage.loading": "Loading...",
  "loansPage.empty": "No loans found",
  "loansPage.btnRepayment": "Repayment",
  "loansPage.btnReceipt": "Receipt",
  "loansPage.previous": "Previous",
  "loansPage.next": "Next",
  "loansPage.pageOf": "Page {page} of {total}",

  // -- VendorList / VendorFormModal (shared vendor domain) --
  "vendorList.loadFailed": "Failed to load vendors",
  "vendorList.confirmDelete": "Are you sure you want to delete {name}?",
  "vendorList.deleteFailed": "Failed to delete vendor",
  "vendorList.deleteError": "An error occurred while deleting the vendor",
  "vendorList.title": "Vendor Management",
  "vendorList.subtitle": "Manage vendors and suppliers",
  "vendorList.add": "Add Vendor",
  "vendorList.search": "Search",
  "vendorList.searchPlaceholder": "Search by name, contact, or account number...",
  "vendorList.typeLabel": "Vendor Type",
  "vendorList.allTypes": "All Types",
  "vendorList.typeUtility": "Utility",
  "vendorList.typeSupplier": "Supplier",
  "vendorList.typeServiceProvider": "Service Provider",
  "vendorList.typeContractor": "Contractor",
  "vendorList.typeLender": "Lender",
  "vendorList.typeOther": "Other",
  "vendorList.statusLabel": "Status",
  "vendorList.allStatus": "All Status",
  "vendorList.statusActive": "Active",
  "vendorList.statusInactive": "Inactive",
  "vendorList.empty": "No vendors found",
  "vendorList.colName": "Vendor Name",
  "vendorList.colType": "Type",
  "vendorList.colContact": "Contact",
  "vendorList.colAccount": "Account Number",
  "vendorList.colTerms": "Payment Terms",
  "vendorList.colStatus": "Status",
  "vendorList.colActions": "Actions",
  "vendorList.edit": "Edit",
  "vendorList.delete": "Delete",

  // -- VendorFormModal --
  "vendorForm.errorNameRequired": "Vendor name is required",
  "vendorForm.errorEmail": "Please enter a valid email address",
  "vendorForm.errorWebsite": "Please enter a valid website URL (starting with http:// or https://)",
  "vendorForm.saveFailedUpdate": "Failed to update vendor",
  "vendorForm.saveFailedCreate": "Failed to create vendor",
  "vendorForm.saveError": "An error occurred while saving the vendor",
  "vendorForm.editTitle": "Edit Vendor",
  "vendorForm.addTitle": "Add Vendor",
  "vendorForm.editSubtitle": "Update vendor information",
  "vendorForm.addSubtitle": "Add a new vendor to the system",
  "vendorForm.name": "Vendor Name",
  "vendorForm.type": "Vendor Type",
  "vendorForm.contactInfo": "Contact Information",
  "vendorForm.contactPerson": "Contact Person",
  "vendorForm.email": "Email",
  "vendorForm.phone": "Phone Number",
  "vendorForm.website": "Website",
  "vendorForm.address": "Address",
  "vendorForm.businessDetails": "Business Details",
  "vendorForm.accountNumber": "Account Number",
  "vendorForm.accountPlaceholder": "Church account number with vendor",
  "vendorForm.paymentTerms": "Payment Terms",
  "vendorForm.paymentTermsPlaceholder": "e.g., Net 30, Due on receipt",
  "vendorForm.taxId": "Tax ID / EIN",
  "vendorForm.taxIdPlaceholder": "Vendor tax ID or EIN",
  "vendorForm.activeVendor": "Active Vendor",
  "vendorForm.notes": "Notes",
  "vendorForm.notesPlaceholder": "Additional notes about this vendor...",
  "vendorForm.cancel": "Cancel",
  "vendorForm.saving": "Saving...",
  "vendorForm.update": "Update Vendor",

  // -- EmployeeList / EmployeeFormModal (shared employee domain) --
  "employeeList.loadFailed": "Failed to load employees",
  "employeeList.confirmDelete": "Are you sure you want to delete {name}?",
  "employeeList.deleteFailed": "Failed to delete employee",
  "employeeList.deleteError": "An error occurred while deleting the employee",
  "employeeList.title": "Employee Management",
  "employeeList.subtitle": "Manage church employees and staff",
  "employeeList.add": "Add Employee",
  "employeeList.search": "Search",
  "employeeList.searchPlaceholder": "Search by name, email, or position...",
  "employeeList.typeLabel": "Employment Type",
  "employeeList.allTypes": "All Types",
  "employeeList.typeFullTime": "Full-time",
  "employeeList.typePartTime": "Part-time",
  "employeeList.typeContract": "Contract",
  "employeeList.typeVolunteer": "Volunteer",
  "employeeList.statusLabel": "Status",
  "employeeList.allStatus": "All Status",
  "employeeList.statusActive": "Active",
  "employeeList.statusInactive": "Inactive",
  "employeeList.empty": "No employees found",
  "employeeList.colName": "Name",
  "employeeList.colPosition": "Position",
  "employeeList.colType": "Employment Type",
  "employeeList.colSalary": "Salary",
  "employeeList.colStatus": "Status",
  "employeeList.colActions": "Actions",
  "employeeList.edit": "Edit",
  "employeeList.delete": "Delete",
  "employeeList.freqWeekly": "weekly",
  "employeeList.freqBiWeekly": "bi-weekly",
  "employeeList.freqMonthly": "monthly",
  "employeeList.freqAnnual": "annual",
  "employeeList.freqPerService": "per-service",

  // -- EmployeeFormModal --
  "employeeForm.errorFirstName": "First name is required",
  "employeeForm.errorLastName": "Last name is required",
  "employeeForm.errorEmail": "Please enter a valid email address",
  "employeeForm.errorSsn": "SSN last four must be exactly 4 digits",
  "employeeForm.saveFailedUpdate": "Failed to update employee",
  "employeeForm.saveFailedCreate": "Failed to create employee",
  "employeeForm.saveError": "An error occurred while saving the employee",
  "employeeForm.editTitle": "Edit Employee",
  "employeeForm.addTitle": "Add Employee",
  "employeeForm.editSubtitle": "Update employee information",
  "employeeForm.addSubtitle": "Add a new employee to the system",
  "employeeForm.firstName": "First Name",
  "employeeForm.lastName": "Last Name",
  "employeeForm.position": "Position",
  "employeeForm.positionPlaceholder": "e.g., Priest, Deacon, Secretary",
  "employeeForm.type": "Employment Type",
  "employeeForm.contactInfo": "Contact Information",
  "employeeForm.email": "Email",
  "employeeForm.phone": "Phone Number",
  "employeeForm.address": "Address",
  "employeeForm.employmentDetails": "Employment Details",
  "employeeForm.hireDate": "Hire Date",
  "employeeForm.terminationDate": "Termination Date",
  "employeeForm.activeEmployee": "Active Employee",
  "employeeForm.compensation": "Compensation",
  "employeeForm.salaryAmount": "Salary Amount",
  "employeeForm.salaryFrequency": "Salary Frequency",
  "employeeForm.selectFrequency": "-- Select Frequency --",
  "employeeForm.freqWeekly": "Weekly",
  "employeeForm.freqBiWeekly": "Bi-weekly",
  "employeeForm.freqMonthly": "Monthly",
  "employeeForm.freqAnnual": "Annual",
  "employeeForm.freqPerService": "Per Service",
  "employeeForm.taxInfo": "Tax Information",
  "employeeForm.ssnLastFour": "SSN Last Four",
  "employeeForm.taxId": "Tax ID / EIN",
  "employeeForm.taxIdPlaceholder": "For 1099 contractors",
  "employeeForm.notes": "Notes",
  "employeeForm.notesPlaceholder": "Additional notes about this employee...",
  "employeeForm.cancel": "Cancel",
  "employeeForm.saving": "Saving...",
  "employeeForm.update": "Update Employee",

  // -- MemberDuesViewer --
  "memberDues.statementFailed": "Failed to generate statement",
  "memberDues.duesFetchFailed": "Failed to fetch member dues",
  "memberDues.unableToLoad": "Unable to load data",
  "memberDues.goBack": "Go Back",
  "memberDues.householdFinances": "Household Finances",
  "memberDues.householdOf": "{name}'s Household",
  "memberDues.membersCount": "{count} Members",
  "memberDues.memberFinancialView": "Member Financial View",
  "memberDues.addTransaction": "Add Transaction",
  "memberDues.clearSelection": "Clear selection",
  "memberDues.close": "Close",
  "memberDues.financialYear": "Financial Year {year}",
  "memberDues.membershipDues": "Membership Dues",
  "memberDues.annualPledge": "Annual Pledge",
  "memberDues.monthlyValue": "Monthly Value",
  "memberDues.paidToDate": "Paid To Date",
  "memberDues.balanceDue": "Balance Due",
  "memberDues.percentComplete": "{percent}% COMPLETE",
  "memberDues.duesCalcFrom": "Dues are calculated starting from {name}'s parish join date.",
  "memberDues.duesCalcStandard": "Calculations based on standard contribution rates",
  "memberDues.totalReceived": "Total Received",
  "memberDues.yearOverYear": "Year-over-Year",
  "memberDues.stableGrowth": "Stable Growth",
  "memberDues.systemId": "System ID",
  "memberDues.additionalContributions": "Additional Contributions Breakdown",
  "memberDues.donations": "Donations",
  "memberDues.pledges": "Pledges",
  "memberDues.tithes": "Tithes",
  "memberDues.offerings": "Offerings",
  "memberDues.otherContrib": "Other",
  "memberDues.totalAdditional": "Total Additional",
  "memberDues.distributionTimeline": "Annual Distribution Timeline",
  "memberDues.legendPaid": "Paid",
  "memberDues.legendPending": "Pending",
  "memberDues.legendUpcoming": "Upcoming",
  "memberDues.received": "Received",
  "memberDues.required": "Required",
  "memberDues.ledgerTitle": "Detailed Transaction Ledger ({year})",
  "memberDues.recordsFound": "{count} Records Found",
  "memberDues.colPostDate": "Post Date",
  "memberDues.colReference": "Reference",
  "memberDues.colType": "Type",
  "memberDues.colMechanism": "Mechanism",
  "memberDues.colOrigin": "Origin",
  "memberDues.colAmount": "Amount",
  "memberDues.emptyLedger": "Historical records empty for {year}",
  "memberDues.authorizedStatement": "Authorized Financial Statement • Generated {date}",
  "memberDues.generating": "Generating...",
  "memberDues.printStatement": "Print Statement",
  "memberDues.clearSelectionBtn": "Clear Selection",
  "memberDues.finishReview": "Finish Review",

  // -- SmsBroadcast --
  "smsBroadcast.notAuthenticated": "Not authenticated",
  "smsBroadcast.messageRequired": "Message is required",
  "smsBroadcast.messageTooLong": "Message is too long. Please reduce by {count} characters.",
  "smsBroadcast.selectMemberError": "Please select a member",
  "smsBroadcast.selectDepartmentError": "Please select a department",
  "smsBroadcast.sendFailed": "Failed to send SMS",
  "smsBroadcast.loadDepartmentsFailed": "Failed to load departments",
  "smsBroadcast.loadMembersFailed": "Failed to load members",
  "smsBroadcast.sentIndividual": "Message sent successfully to the selected member.",
  "smsBroadcast.sentDepartment": "Department message sent to \"{name}\". Success: {success} / {total}",
  "smsBroadcast.sentPending": "Message sent to members with pending pledges. Success: {success} / {total}",
  "smsBroadcast.sentFulfilled": "Message sent to members with fulfilled pledges. Success: {success} / {total}",
  "smsBroadcast.sentAll": "Broadcast request queued. Success: {success} / {total}",
  "smsBroadcast.accessDenied": "Access Denied",
  "smsBroadcast.noPermission": "You don't have permission to send SMS communications.",
  "smsBroadcast.title": "SMS Communications",
  "smsBroadcast.selectRecipientType": "Select Recipient Type",
  "smsBroadcast.typeIndividual": "Individual",
  "smsBroadcast.typeDepartment": "Department",
  "smsBroadcast.typePending": "Pending Pledges",
  "smsBroadcast.typeFulfilled": "Fulfilled Pledges",
  "smsBroadcast.typeAll": "All Members",
  "smsBroadcast.selectMember": "Select Member",
  "smsBroadcast.searchMembersPlaceholder": "Search members by name or phone…",
  "smsBroadcast.loadingMembers": "Loading members…",
  "smsBroadcast.selectMemberOption": "-- Select a member --",
  "smsBroadcast.selectDepartment": "Select Department",
  "smsBroadcast.loadingDepartments": "Loading departments…",
  "smsBroadcast.selectDepartmentOption": "-- Select a department --",
  "smsBroadcast.deptOptionMembers": "members",
  "smsBroadcast.onlyActiveDepts": "Only active departments with members are listed.",
  "smsBroadcast.departmentMembers": "Department Members",
  "smsBroadcast.loading": "Loading...",
  "smsBroadcast.willReceiveSuffix": "members will receive this message",
  "smsBroadcast.hide": "Hide",
  "smsBroadcast.show": "Show",
  "smsBroadcast.memberList": "member list",
  "smsBroadcast.recipientList": "recipient list",
  "smsBroadcast.noDeptMembers": "No active members with phone numbers found in this department.",
  "smsBroadcast.pendingRecipients": "Pending Pledges Recipients",
  "smsBroadcast.fulfilledRecipients": "Fulfilled Pledges Recipients",
  "smsBroadcast.pendingPledgesCount": "{count} pending pledges (Total: ${total})",
  "smsBroadcast.fulfilledPledgesCount": "{count} fulfilled pledges (Total: ${total})",
  "smsBroadcast.noPendingPledges": "No members found with pending pledges.",
  "smsBroadcast.noFulfilledPledges": "No members found with fulfilled pledges.",
  "smsBroadcast.messageLabel": "Message",
  "smsBroadcast.templateVarsTitle": "💡 Available Template Variables:",
  "smsBroadcast.varFirstName": "First name",
  "smsBroadcast.varLastName": "Last name",
  "smsBroadcast.varFullName": "Full name",
  "smsBroadcast.varAmount": "Pledge amount (single)",
  "smsBroadcast.varTotalAmount": "Total of all pledges",
  "smsBroadcast.varPledgeCount": "Number of pledges",
  "smsBroadcast.varDueDate": "Due date (single)",
  "smsBroadcast.personalizedNote": "Each member will receive a personalized message!",
  "smsBroadcast.placeholderPending": "Example: Hi {firstName}, reminder about your pending pledge of {amount}. Due: {dueDate}. Thank you!",
  "smsBroadcast.placeholderFulfilled": "Example: Thank you {firstName} for fulfilling your pledge of {amount}! God bless you.",
  "smsBroadcast.placeholderDefault": "Type your SMS message…",
  "smsBroadcast.tooLongBy": "Message is too long by {count} characters",
  "smsBroadcast.charsRemaining": "{count} characters remaining",
  "smsBroadcast.totalSmsChars": "Total SMS: {used} / {max} chars",
  "smsBroadcast.costPrefix": "Est. Cost:",
  "smsBroadcast.segmentsWord": "segments",
  "smsBroadcast.recipientsWord": "recipients",
  "smsBroadcast.segsWord": "segs",
  "smsBroadcast.approxCost": "(Approx. ${cost})",
  "smsBroadcast.standardEncoding": "Standard Encoding",
  "smsBroadcast.unicodeEncoding": "Unicode Encoding",
  "smsBroadcast.pricingBreakdown": "${base} base + ${carrier} carrier / seg",
  "smsBroadcast.includeFooter": "Include automated footer",
  "smsBroadcast.footerHelp": "Uncheck to remove the standard compliance message. Please ensure you still identify the sender manually.",
  "smsBroadcast.sending": "Sending…",
  "smsBroadcast.sendSms": "Send SMS"

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
      whatsapp: "ናብ WhatsApp ተሳተፍ",
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
      zelle: "ዜል ክፍሊታት",
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
      collectionProgress: "ትልሚ ኣከባብ ክፍሊት",
      pageTitle: "ናይ ፋይናንስ ሓጺር መግለጺ",
      yearLabel: "ዓመት",
      totalReceipts: "ጠቕላሊ እቶት",
      ytdBalance: "ናይ ዓመት ሕሳብ",
      surplus: "ትርፊ",
      deficit: "ጉድለት",
      annualDuesProgress: "ናይ ዓመት ኣባልነት ክፍሊት",
      collectedOf: "ተኣኺቡ ካብ",
      stillOutstanding: "ዝተረፈ",
      otherIncome: "ካልእ እቶት",
      currentBalance: "ሕሳብ ባንኪ",
      lastUpdated: "ዝተሓደሰሉ",
      balanceNote: "ሕሳብ ኣብ መዝገብ ዘለዉ ኩሎም ንግዳት የንጸባርቕ እዩ፣ ብዓመት ኣይተፈልየን",
      target: "ዕላማ",
      onPace: "ፍጥነት ኣከባ",
      onPaceHelp: "ዝተኣከበ ክፍሊት ኣንጻር ክሳብ እዚ እዋን ክኽፈል ዝጽበ (ከፊላዊ ክፍሊት እውን ይቑጸር)። ኣባላት ኣቐዲሞም ምስ ዝኸፍሉ ካብ 100% ክሓልፍ ይኽእል።",
      pledged: "ተማባጺዑ",
      membershipDues: "ናይ ኣባልነት ክፍሊት",
      otherDonations: "ካልእ ሽልማታት",
      reconcileRequired: "ምስ ናይ ባንኪ መግለጺ ኣይሰማምዕን — ምዕራይ የድሊ",
      reconcileLedger: "መዝገብ",
      reconcileBank: "ባንኪ",
      reconcileDiff: "ፍልልይ",
    },
    health: {
      title: "ጥዕና ኣባልነት",
      financialHealth: "ናይ ፋይናንስ ጥዕና",
      duesAndMemberStatus: "ክፍሊት ኣባልነትን ኩነታት ኣባላትን",
      activeGivers: "ዝኸፍሉ ኣባላት",
      totalMembers: "ካብ {count} ኣባላት",
      upToDate: "እዋናዊ ዝኸፈሉ",
      behind: "ዝተረፎም",
      fullyPaid: "ብምሉኡ ከፊሉ",
      behindOnDues: "ዕዳ ኣለዎ",
      activeMembers: "ንጡፋት ኣባላት",
      membershipDues: "ናይ ኣባልነት ክፍሊት",
      otherDonations: "ካልእ ሽልማታት",
    },
    transactionList: {
      filters: {
        memberSearch: "ኣባል ድለ",
        receiptNumber: "ቁጽሪ ቅብሊት",
        paymentType: "ዓይነት ክፍሊት",
        paymentMethod: "ገባሪ ክፍሊት",
        minAmount: "ዝተሓተ መጠን",
        maxAmount: "ዝለዓለ መጠን",
        dateRange: "እዋን",
        startDate: "መጀመሪ ዕለት",
        endDate: "መወዳእታ ዕለት",
        apply: "ኣጣሪ",
        placeholder: {
          search: "ኣባል ድለ (ብውሑዱ 3 ፊደላት)...",
          receipt: "ቁጽሪ ቅብሊት ድለ...",
          minAmount: "ዝተሓተ መጠን",
          maxAmount: "ዝለዓለ መጠን"
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
        transactionId: "መፍለይ ክፍሊት (ID)",
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
        tigray_hunger_fundraiser: "ረድኤት ንጥሙያት ትግራይ",
        other: "ካልእ"
      },
      methods: {
        cash: "ብጥረ ገንዘብ",
        check: "ቼክ",
        zelle: "ዜል",
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
        checkNumber: "ቁጽሪ ቼክ",
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
        checkNumber: "ቁጽሪ ቼክ",
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
          monthly: "ወርሓዊ ጸብጻብ",
          fundraiser: "ረድኤት ንጥሙያት ትግራይ"
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
      descriptions: {
        admin: "ምሉእ ሓላፍነት ስርዓት። ኣባላት፣ መዝነታት፣ ቅጥዕታት ስርዓት ክመሓድር ይኽእል።",
        church_leadership: "ላዕለዋይ አመራርሓ። መብዛሕትኡ ሓበሬታ ክርኢ፣ ባጀት ከጽድቕን መደባት ክመርሕን ይኽእል።",
        treasurer: "ዋና ተሓዝ ገንዘብ። ኩሉ ኣታዊ፣ ወጻኢ፣ መብጽዓታትን ጸብጻባትን ክመሓድር ይኽእል።",
        secretary: "ዋና ጸሓፊ። መዝገብ ኣባላት፣ ማውጫን ርክባትን ክመሓድር ይኽእል።",
        bookkeeper: "ሒሳብ ሹም። ዕለታዊ ኣታዊን ወጻኢን ክምዝግብን ባንኪ ከረክብን ይኽእል።",
        budget_committee: "ኮሚቴ ባጀት። ኩሉ פיናንሳዊ ሓበሬታ ክርኢን ባጀት ከጽድቕን ይኽእል፣ ግን ለውጢ ክገብር ኣይኽእልን።",
        auditor: "ተቆጻጻሪ። ንኩሉ פיናንሳዊ መዝገባትን ስርዓታትን ከረጋግጽ ጥራይ ይኽእል (ንባብ ጥራይ)።",
        ar_team: "ጉጅለ ኣታዊ (AR)። ውህብቶን ክፍሊትን ኣባላት ክምዝግብ ይኽእል።",
        ap_team: "ጉጅለ ወጻኢ (AP)። ወጻኢታትን ክፍሊት ነጋዶን ክምዝግብ ይኽእል።",
        relationship: "ዝምድናታት። ምክትታል ኣባላትን ርክባትን ክመሓድር ይኽእል።",
        member: "ኣባልን። ናይ ባዕሉ ሓበሬታ ክርኢ፣ ስድራቤቱ ክመሓድርን ውህብቶ ክህብን ይኽእል።"
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
  },
  outreachDashboard: {
    title: "ዝምድናን ርክብን ኣባላት",
    churchTvView: "ናይ ቤተክርስቲያን ቲቪ ትርኢት",
    welcomeTitle: "እንቋዕ ናብ ስድራቤት ቤተክርስቲያና ብደሓን መጻእኩም!",
    welcomeSubtitle: "ምሳና ስለ ዝኾንኩም ብሩኻት ኢና።",
    loadingMembers: "ሓደስቲ ኣባላት ይጽዕን ኣሎ...",
    noNewMembers: "ኣብዚ እዋን ዝቕበልዎም ሓደስቲ ኣባላት የለዉን።",
    andFamily: "ብኣባላት ስድራ",
    tvFooterMessage: "ሓደስቲ ኣባላት፡ በጃኹም ድሕሪ ቅዳሴ ኣብ ታሕታይ ደርቢ ምስ ኮሚተ ርክብና ተራኸቡ።",
    pendingWelcomes: "ዝጽበዩ ዘለዉ ኣባላት",
    pendingDesc: "ዝተመዝገቡ ግና ዛጊድ ዘይተቐበልናዮም ኣባላት።",
    refresh: "ኣሐድስ",
    onboardingQueue: "መስርዕ ኣቀባብላ",
    onboardingDesc: "ምስ ኣባል ምስ ተራኸብኩም \"ተቐቢልናዮም\" ኢልኩም መዝግቡ።",
    loadingPending: "ዝጽበዩ ኣባላት ይጽዕን ኣሎ...",
    allCaughtUp: "ኩሉ ተዛዚሙ! ዝጽበዩ የለዉን።",
    tabs: {
      pending: "ዝጽበዩ ዘለዉ",
      welcomed: "ዝተቐበልናዮም",
      announcements: "ሓበሬታታት"
    },
    welcomedColumns: {
      memberNumber: "መለለዪ ኣባል",
      familySize: "ብዝሒ ስድራ",
      dateJoined: "ዝተጸምበረሉ ዕለት",
      welcomedBy: "ተቐባሊ",
      welcomeNote: "መዘኻኸሪ ኣቀባብላ"
    },
    loadingWelcomed: "ዝተቐበልናዮም ኣባላት ይጽዕን ኣሎ...",
    noWelcomedMembers: "ዝተቐበልናዮም ኣባላት ኣይተረኽቡን።",
    table: {
      name: "ሽም",
      contact: "ኣድራሻ",
      action: "ተግባር"
    },
    markWelcomed: "ተቐቢልናዮ",
    noPermission: "ፍቓድ የብልካን",
    welcomedSuccess: "መዘኻኸሪ ኣቀባብላ ተዓቂቡ ኣባል ተቐቢልናዮ ተባሂሉ ተመዝጊቡ።",
    announcements: {
      tabTitle: "ሓበሬታታት",
      addButton: "ሓበሬታ ወሰኽ",
      editButton: "ኣርም",
      cancelButton: "ሰርዝ",
      statusActive: "ንጡፍ",
      statusExpired: "ገደፍ",
      statusCancelled: "ተሰሪዙ",
      filterAll: "ኹሉ",
      titleLabel: "ኣርእስቲ",
      descriptionLabel: "መግለጺ",
      startDateLabel: "ዕለት ምጅማር",
      endDateLabel: "ዕለት ምዝዛም",
      modalCreateTitle: "ሓድሽ ሓበሬታ",
      modalEditTitle: "ሓበሬታ ኣርም",
      saveButton: "ዕቀብ",
      confirmCancel: "ሓበሬታ ክትሰርዞ? እዚ ክምለስ ኣይክእልን።",
      noAnnouncements: "ሓበሬታ ኣይተረኸበን።",
      titleTiLabel: "ኣርእስቲ (ትግርኛ)",
      descriptionTiLabel: "መግለጺ (ትግርኛ)",
      tigrinyaSectionToggle: "ትርጉም ትግርኛ ወሲኽ",
      columns: {
        title: "ኣርእስቲ",
        dates: "ዕለታት",
        status: "ኩነታት",
        actions: "ተግባር"
      }
    },
    tvSettings: {
      gearLabel: "ቴለቪዥን መቆጻጸሪ",
      intervalLabel: "ዙረት ኣብ (ካልኢታት)",
      saveLabel: "ዕቀብ"
    },
    addWelcomeNote: {
      title: "ናይ ኣቀባብላ መዘኻኸሪ ወስኽ",
      for: "ን",
      summary: "ሓጺር መግለጺ ኣባል",
      phone: "ቴሌፎን:",
      email: "ኢሜይል:",
      pledge: "ዓመታዊ መብጽዓ:",
      address: "ኣድራሻ:",
      registration: "ምዝገባ:",
      householdSize: "ብዝሒ ስድራቤት:",
      loadingProfile: "ፕሮፋይል ይጽዕን ኣሎ...",
      profileUnavailable: "ፕሮፋይል የለን",
      noteLabel: "መዘኻኸሪ (1-2000 ፊደላት)",
      notePlaceholder: "በጃኹም ናይ ሰላምታን ርእይቶን መዘኻኸሪ ኣስፍሩ። ንኣብነት፡ ብዛዕባ ቤተሰቦምን ዝርዝር ስድራቤቶምን ሓቲትናዮም፣ ናብ ዳላስ መኣስ ከም ዝመጹ፣ ከምኡ'ውን እግዚኣብሔር ከም ዝፈቐዶ መጠን ዓመታዊ ናይ ኣባልነት ክፍሊት ክጅምሩ ብትሕትና ሓቲትናዮም።",
      charMin: "እንተወሓደ 3 ፊደላት የእትዉ",
      looksGood: "ጽቡቕ ኣሎ",
      remaining: "ተሪፉ",
      cancel: "ሰርዝ",
      save: "ቀምጥ",
      saving: "ይቅመጥ ኣሎ..."
    }
  },

  // ==== Consolidated legacy flat keys (Phase 1 migration) — DRAFT, pending native review ====
  "admin.panel": "ፓነል ኣመሓዳሪ",
  "manage.members": "ኣባላት ኣመሓድር",
  "manage.members.and.roles": "ኣባላትን ሓላፍነታትን ኣመሓድር",
  "access.admin.panel": "ናብ ፓነል ኣመሓዳሪ እተ",
  "role.management": "ምሕደራ ሓላፍነት",
  "manage.member.roles.and.permissions": "ሓላፍነትን ፍቓዳትን ኣባላት ኣመሓድር",
  "update.member.roles": "ሓላፍነታት ኣባላት ኣሐድስ",
  "change.role": "ሓላፍነት ቀይር",
  "new.role": "ሓድሽ ሓላፍነት",
  "current.role": "ህሉው ሓላፍነት",
  "role.descriptions": "መግለጺ ሓላፍነታት",
  "update.role": "ሓላፍነት ኣሐድስ",
  "updating.role.for": "ሓላፍነት የሐድስ ኣሎ ን",
  "new.permissions": "ሓደስቲ ፍቓዳት",
  "updating": "የሐድስ ኣሎ...",
  "statistics": "ስታቲስቲክስ",
  "overview.of.church.membership": "ሓፈሻዊ ትሕዝቶ ኣባልነት ቤተ ክርስቲያን",
  "active.members": "ንጡፋት ኣባላት",
  "total.children": "ጠቕላላ ህጻናት",
  "recent.registrations": "ናይ ቀረባ እዋን ምዝገባታት",
  "role.breakdown": "ኣከፋፍላ ሓላፍነት",
  "gender.breakdown": "ኣከፋፍላ ጾታ",
  "marital.status.breakdown": "ኣከፋፍላ ኩነታት መርዓ",
  "language.preference.breakdown": "ኣከፋፍላ ምርጫ ቋንቋ",
  "membership.status": "ኩነታት ኣባልነት",
  "members.with.children": "ህጻናት ዘለዎም ኣባላት",
  "activity.metrics": "መለክዒ ንጥፈታት",
  "new.registrations.30.days": "ሓደስቲ ምዝገባታት (30 መዓልቲ)",
  "avg.children.per.family": "ማእከላይ ህጻናት ብቤተሰብ",
  "active.rate": "መጠን ንጡፋት",
  "quick.actions": "ቅልጡፍ ተግባራት",
  "export.member.list": "ዝርዝር ኣባላት ኣውጽእ",
  "generate.report": "ጸብጻብ ኣውጽእ",
  "send.communication": "መልእኽቲ ስደድ",
  "refresh.statistics": "ስታቲስቲክስ ኣሐድስ",
  "no.data.available": "ዳታ የለን",
  "edit.member": "ኣባል ኣርም",
  "search": "ድለ",
  "all.roles": "ኩሎም ሓላፍነታት",
  "all.statuses": "ኩሉ ኩነታት",
  "active": "ንጡፍ",
  "inactive": "ዘይንጡፍ",
  "joined": "ዝተጸምበረ",
  "children": "ህጻናት",
  "current.permissions": "ህሉው ፍቓዳት",
  "confirm.delete.member": "ነዚ ኣባል ክትድምስሶ ርግጸኛ ዲኻ?",
  "basic.info": "ቀንዲ ሓበሬታ",
  "contact.info": "ሓበሬታ ርክብ",
  "street.address": "ኣድራሻ ጎደና",
  "ministries": "ኣገልግሎታት",
  "ministries.placeholder": "ዝግደሰሎም ኣገልግሎታት ዘርዝር...",
  "bank_transfer": "ብባንኪ ምትሕልላፍ",
  "select.language": "ቋንቋ ምረጽ",
  "english": "እንግሊዝኛ",
  "tigrinya": "ትግርኛ",
  "amharic": "ኣምሓርኛ",
  "no.children.registered": "ዝተመዝገበ ህጻን የለን",
  "spiritual.father": "መንፈሳዊ ኣቦ",
  "contact.address": "ርክብን ኣድራሻን",
  "common.edit": "ኣርም",
  "common.delete": "ደምስስ",

  // ==== Shared: Gregorian month short names (DRAFT, transliteration) ====
  months: {
    short: {
      january: "ጃን", february: "ፌብ", march: "ማርች", april: "ኤፕሪ",
      may: "ሜይ", june: "ጁን", july: "ጁላይ", august: "ኦገስ",
      september: "ሴፕቴ", october: "ኦክቶ", november: "ኖቬም", december: "ዲሴም"
    }
  },

  // ==== DuesPage (Phase 2a) — DRAFT, pending native review ====
  duesPage: {
    signInRequired: "ክፍሊት ንምርኣይ ክትኣትዉ ኣለኩም።",
    dependentNotLinked: "ናይ ተጸባዪ መለለዪኹም ምስ ሓላፊ ቤተሰብ ገና ኣይተኣሳሰረን። በጃኹም ንሓላፊ ቤተሰብ ተወከሱ ወይ ባዕልኹም ናይ ምጥያቕ መስርሕ ተጠቐሙ።",
    loadFailed: "ክፍሊት ምጽዓን ኣይተኻእለን",
    statementFailed: "መግለጺ ምውጻእ ኣይተኻእለን",
    retry: "ዳግማይ ፈትን",
    title: "ክፍሊት ኣባላት",
    calculatedFrom: "ካብ ዕለት ምጽንባር ናብ ቤተ ክርስቲያን ዝተሓስበ",
    monthlyStatus: "ወርሓዊ ኩነታት",
    dueShort: "ክፍሊት",
    monthlyCommitment: "ወርሓዊ ቃል ኪዳን:",
    paymentHistory: "ታሪኽ ክፍሊት",
    noPayments: "ኣብዚ ዓመት ዝተረኽበ ክፍሊት የለን።",
    stat: {
      collected: "ዝተኣከበ",
      balanceDue: "ዝተረፈ ክፍሊት",
      otherPayments: "ካልኦት ክፍሊታት",
      yearlyPledge: "ዓመታዊ ቃል ኪዳን"
    },
    col: {
      date: "ዕለት",
      amount: "መጠን",
      type: "ዓይነት",
      method: "ኣገባብ",
      receipt: "ቁ. ደረሰኝ",
      note: "መዘኻኸሪ",
      status: "ኩነታት"
    },
    status: {
      pending: "ይጽበ ኣሎ",
      succeeded: "ተዓዊቱ"
    },
    statement: {
      title: "ዓመታዊ መግለጺ ወፈያ",
      desc: "ንግብሪ ዝቕነስ መግለጺ ወፈያኹም ንዓመተ {year} ኣውጽኡ።",
      print: "መግለጺ ሓትም"
    }
  },

  // ==== DonatePage (Phase 2a) — DRAFT, pending native review ====
  donatePage: {
    title: "ንቤተ ክርስቲያንና ደግፉ",
    subtitle: "ልግስኹም ወፈያ ተልእኾና ንኽንቕጽልን ንማሕበረሰብና ንኸነገልግልን ይሕግዘና።",
    onlineDonation: "ብኢንተርነት ወፈያ",
    howOften: "ክንደይ ግዜ ክትውፍዩ ትደልዩ?",
    oneTime: "ሓደ ግዜ",
    recurring: "ተደጋጋሚ",
    frequency: "ድግግሞሽ",
    donationAmount: "መጠን ወፈያ",
    paymentMethod: "ኣገባብ ክፍሊት",
    cardOption: "ክረዲት/ዴቢት ካርድ",
    achOption: "ሕሳብ ባንኪ (ACH)",
    cardInformation: "ሓበሬታ ካርድ",
    bankInformation: "ሓበሬታ ሕሳብ ባንኪ",
    donorInformation: "ሓበሬታ ወፋዪ",
    prefillNoteLabel: "መዘኻኸሪ:",
    prefillNoteBody: "ሓበሬታኹም ካብ ፕሮፋይልኩም ኣቐዲሙ ተመሊኡ ኣሎ። ኣድላዪ እንተኾይኑ ዝኾነ መዝገብ ከተመሓይሹ ትኽእሉ ኢኹም።",
    resetToProfile: "ናብ ፕሮፋይል መልስ",
    firstName: "ስም *",
    lastName: "ስም ኣቦ *",
    email: "ኢመይል",
    phoneNumber: "ቁጽሪ ስልኪ",
    billingAddress: "ኣድራሻ ክፍሊት",
    zipCode: "ዚፕ ኮድ",
    processing: "ይካየድ ኣሎ...",
    continueToPayment: "ናብ ክፍሊት ቀጽል - ${amount}",
    paymentSuccessMsg: "ክፍሊት ተዓዊቱ! ስለ ወፈያኹም ነመስግን።",
    freq: {
      weekly: "ሰሙናዊ",
      monthly: "ወርሓዊ",
      quarterly: "ርብዒ ዓመታዊ",
      yearly: "ዓመታዊ"
    },
    errors: {
      amountDecimals: "ቅኑዕ መጠን ኣእትዉ (ቁጽሪ ጥራይ፣ ክሳብ 2 ዓሽር)።",
      amountDecimalsAlert: "በጃኹም ቅኑዕ መጠን ኣእትዉ (ቁጽሪ ጥራይ፣ ክሳብ 2 ዓሽር)።",
      amountExample: "በጃኹም ቅኑዕ መጠን ኣእትዉ (ንኣብነት 10 ወይ 10.00)",
      amountMin: "ዝወሓደ መጠን $1.00 እዩ",
      amountMinAlert: "በጃኹም ቅኑዕ መጠን ኣእትዉ (ዝወሓደ $1.00)",
      nameRequired: "በጃኹም ስምኩምን ስም ኣቦኹምን ምልኡ",
      cardNotReady: "ናይ ካርድ ክፍሊት መስርሕ ገና ድሉው ኣይኮነን። በጃኹም ደጊምኩም ፈትኑ።",
      achNotReady: "ናይ ACH ክፍሊት መስርሕ ገና ድሉው ኣይኮነን። በጃኹም ደጊምኩም ፈትኑ።",
      unexpected: "ዘይተጸበኹሞ ጌጋ ተፈጢሩ"
    },
    thankYou: "ስለ ${amount} ወፈያኹም ነመስግን! ክፍሊትኩም ብዓወት ተሰሪሑ።",
    auth: {
      template: "ነዚ ነጋዳይ ወይ ወኪሉ ነቲ ኣብ ላዕሊ ተጠቒሱ ዘሎ መጠን {action} ንኽገብር ፍቓድ እህብ {recurring}፣ ነቲ ኣብ ታሕቲ ዘሎ \"ናብ ክፍሊት ቀጽል\" መልጎም ምስ ጠወቕኩ ብቕጽበት። እቲ ዝፈቕዶ {method} ግብይታት ምስ ኩሉ ተፈጻሚ ሕጊ ከም ዝሰማማዕ እቕበል።",
      chargeCard: "ካብ ክረዲት ካርደይ ንኽትከፍሉ",
      debitAccount: "ካብ ሕሳበይ ንኽትከፍሉ",
      recurringClause: "ብ{frequency} ተደጋጋሚ ክፍሊታት",
      methodCard: "ክረዲት ካርድ",
      methodAch: "ACH"
    },
    zelle: {
      title: "ብዘለ ውፈዩ",
      qrAlt: "ናይ ኣቡነ ኣረጋዊ ቤተ ክርስቲያን ዘለ QR ኮድ",
      imageFallbackPre: "ስእሊ እንተዘይተጻዒኑ፣ ",
      imageFallbackLink: "QR ኮድ ክፈት",
      scanHint: "ብዘለ ንምውፋይ ነዚ QR ኮድ ኣብ ናይ ባንኪ መተግበሪኹም ኣንብቡ።",
      emailLabel: "ናይ ዘለ ኢመይል ኣድራሻ:",
      copyTitle: "ኢመይል ኣድራሻ ንምቕዳሕ ጠውቕ",
      howTitle: "ብዘለ ከመይ ከም እትውፍዩ:",
      step1: "ናይ ባንኪ መተግበሪ ወይ ዘለ መተግበሪ ክፈቱ",
      step2: "\"ገንዘብ ስደድ\" ወይ \"ብዘለ ስደድ\" ምረጹ",
      step3: "ኢመይል ኣድራሻ ኣእትዉ:",
      step4: "መጠን ወፈያኹም ኣእትዉ",
      step5Pre: "መዘኻኸሪ/መልእኽቲ ወስኹ: ",
      step5Memo: "\"[ቁጽሪ ስልክኹም] ን[ምኽንያት]\"",
      step5Hint: "ንግቡእ ምክትታል በጃኹም ቁጽሪ ስልክኹም ኣካትቱ።",
      step6: "ክፍሊትኩም ገምጊምኩም ስደዱ",
      quickCopyLabel: "✅ ቅልጡፍ ቅዳሕ:",
      quickCopyBody: "ነቲ ኣብ ላዕሊ ዘሎ ኢመይል ኣድራሻ ጠዊቕኩም ቅዳሕዎ፣ ሽዑ ናብ ዘለ መተግበሪኹም ለጥፍዎ።"
    },
    check: {
      title: "ብቼክ ውፈዩ",
      payableTo: "ቼክ ንዚ ግበሩ:",
      payee: "ኣቡነ ኣረጋዊ ኦርቶዶክስ ተዋሕዶ ቤተ ክርስቲያን"
    },
    questions: {
      title: "ሕቶታት?",
      body: "ብዛዕባ ወፈያ ሕቶ እንተልዩኩም፣ በጃኹም ተወከሱና:"
    }
  },

  // ==== DependentsManagement (Phase 2a) — DRAFT, pending native review ====
  dependentsPage: {
    loading: "ተጸበይቲ ይጽዕኑ ኣለዉ...",
    title: "መጻምድትን ተጸበይትን",
    add: "ተጸባዪ ወስኽ",
    householdRecord: "መዝገብ ቤተሰብ",
    managedUnderPre: "እዚ መዝገብ ቤተሰብ ኣብ ትሕቲ ",
    managedUnderPost: " ይመሓደር።",
    dependentNote: " ኣብዚ ንቤተሰብ ክትርእዩ ትኽእሉ ኢኹም፣ ግን ናይ ቤተሰብ ምምሕያሻት ብሓላፊ ቤተሰብ ክፍጸሙ ኣለዎም።",
    headNote: " ካብዚ ገጽ ነቲ ምስዚ ቤተሰብ ዝተኣሳሰረ መጻምድትን ውሉድን ክትርእዩን ከተመሓይሹን ትኽእሉ ኢኹም።",
    editTitle: "ተጸባዪ ኣርም",
    addTitle: "ሓድሽ ተጸባዪ ወስኽ",
    firstName: "ስም *",
    middleName: "ስም ኣቦ",
    lastName: "ስም ኣቦሓጎ *",
    dob: "ዕለተ ልደት",
    optional: "ኣማራጺ",
    gender: "ጾታ *",
    male: "ተባዕታይ",
    female: "ኣንስተይቲ",
    relationship: "ዝምድና",
    selectRelationship: "ዝምድና ምረጹ",
    phone: "ስልኪ",
    email: "ኢመይል",
    baptismName: "ስም ጥምቀት",
    isBaptized: "ተጠሚቑ ድዩ",
    cancel: "ሰርዝ",
    update: "ተጸባዪ ኣሐድስ",
    noneYet: "ገና ዝተወሰኸ ተጸባዪ የለን።",
    getStarted: "ንምጅማር \"ተጸባዪ ወስኽ\" ጠውቑ።",
    yes: "እወ",
    no: "ኣይፋል",
    edit: "ኣርም",
    delete: "ደምስስ",
    col: {
      name: "ስም",
      dob: "ዕለተ ልደት",
      gender: "ጾታ",
      relationship: "ዝምድና",
      baptismName: "ስም ጥምቀት",
      baptized: "ተጠሚቑ",
      actions: "ተግባራት"
    },
    errors: {
      prefix: "ጌጋ:",
      notAuthenticated: "ኣይተረጋገጸን",
      profileFailed: "ናይ ኣባል ፕሮፋይል ምርካብ ኣይተኻእለን",
      resolveIdFailed: "መለለዪ ኣባል ክፍታሕ ኣይከኣለን",
      saveError: "ሓበሬታ ተጸባዪ ምዕቃብ ጌጋ ኣጋጠመ",
      deleteConfirm: "ነዚ ተጸባዪ ክትድምስሶ ርግጸኛ ዲኻ?",
      deleteError: "ተጸባዪ ምድምሳስ ጌጋ ኣጋጠመ"
    }
  },

  // ==== PledgeForm (Phase 2a) — DRAFT, pending native review ====
  pledgeForm: {
    title: "ቃል ኪዳን ኣቕርብ",
    subtitle: "ብልግሲ ቃል ኪዳንኩም ንቤተ ክርስቲያንና ደግፉ",
    selectMember: "ኣባል ምረጹ (ኣማራጺ)",
    searchPlaceholder: "ብስም ወይ ብስልኪ ድለ",
    searchAria: "ኣባላት ብስም ወይ ብስልኪ ድለ",
    loadingMembers: "ኣባላት ይጽዕኑ ኣለዉ...",
    selectMatched: "ዝተረኸበ ኣባል ምረጹ ወይ ንኹሎም ንምርኣይ ኣጽርዩ",
    selectExisting: "ዘሎ ኣባል ምረጹ ወይ ንሓድሽ ባዶ ግደፍዎ",
    noMatches: "ዝሰማማዕ የለን",
    noMembers: "ኣባላት ኣይተረኽቡን",
    clearSelection: "ሓበሬታ ሓድሽ ኣባል ንምእታው ምርጫ ኣጽርዩ",
    eventName: "ስም ፍጻመ *",
    eventNamePlaceholder: "ንኣብነት፣ ናይ ሰንበት ናይ ገንዘብ ምእካብ ፍጻመ",
    amount: "መጠን ቃል ኪዳን *",
    customAmountPlaceholder: "ናይ ገዛእ ርእስኹም መጠን ኣእትዉ",
    firstName: "ስም *",
    lastName: "ስም ኣቦ *",
    email: "ኢመይል",
    phone: "ስልኪ",
    autoFilledTitle: "ካብ ዝተመርጸ ኣባል ብኣውቶማቲክ ተመሊኡ",
    autoFilledPlaceholder: "ካብ ኣባል ብኣውቶማቲክ ተመሊኡ",
    address: "ኣድራሻ",
    autoFilledParen: "(ካብ ኣባል ብኣውቶማቲክ ተመሊኡ)",
    optionalParen: "(ኣማራጺ)",
    streetPlaceholder: "ኣድራሻ ጎደና",
    addressModifyHint: "ኣድራሻ ካብ ዝተመርጸ ኣባል - ኣድላዪ እንተኾይኑ ከተመሓይሽዎ ትኽእሉ",
    zip: "ዚፕ ኮድ",
    notes: "መዘኻኸሪ (ኣማራጺ)",
    notesPlaceholder: "ዝኾነ ተወሳኺ መዘኻኸሪ ወይ መወፈዪ...",
    processing: "ይካየድ ኣሎ...",
    submit: "ቃል ኪዳን ${amount}",
    errors: {
      amountMin: "መጠን እንተወሓደ $1.00 ክኸውን ኣለዎ",
      firstNameRequired: "ስም የድሊ",
      lastNameRequired: "ስም ኣቦ የድሊ",
      emailInvalid: "በጃኹም ቅኑዕ ኢመይል ኣድራሻ ኣእትዉ",
      phoneRequired: "ንሓደስቲ ኣባላት ቁጽሪ ስልኪ የድሊ"
    }
  },

  // ==== PledgeTracker (Phase 2a) — DRAFT, pending native review ====
  pledgeTracker: {
    loadFailed: "ስታቲስቲክስ ቃል ኪዳን ምጽዓን ኣይተኻእለን",
    tryAgain: "ዳግማይ ፈትን",
    noData: "ዳታ ቃል ኪዳን የለን",
    eventPledges: "ቃል ኪዳናት {event}",
    title: "ተኸታታሊ ቃል ኪዳን",
    subtitle: "ማሕበረሰብ ቤተ ክርስቲያን ኣቡነ ኣረጋዊ ነዚ ዕላማ ንምድጋፍ ብኸመይ ይተኣኻኸብ ከም ዘሎ ተዓዘቡ።",
    refresh: "ኣሐድስ",
    totalPledged: "ጠቕላላ ቃል ኪዳን",
    totalDonated: "ጠቕላላ ዝተወፈየ",
    remaining: "ዝተረፈ",
    fulfillmentProgress: "ናይ ምፍጻም ኣፈጻጽማ",
    pledgeStatus: "ኩነታት ቃል ኪዳን",
    totalAmount: "ጠቕላላ መጠን",
    anonymous: "ብዘይ ስም",
    lastUpdated: "ናይ መወዳእታ ዝተሓደሰሉ: {time}"
  },

  // ==== ACHPayment (Phase 2a) — DRAFT, pending native review ====
  achPayment: {
    bankInfo: "ሓበሬታ ሕሳብ ባንኪ",
    accountHolderName: "ስም ወናኒ ሕሳብ *",
    routingNumber: "ራውቲንግ ቁጽሪ *",
    routingHint: "እቲ ኣብ ቼክኩም ዝርከብ 9-ኣሃዝ ራውቲንግ ቁጽሪ",
    accountNumber: "ቁጽሪ ሕሳብ *",
    accountNumberHint: "ቁጽሪ ሕሳብ ባንክኹም",
    accountType: "ዓይነት ሕሳብ *",
    checking: "ቸኪንግ",
    savings: "ቁጠባ",
    amountLabel: "መጠን:",
    typeLabel: "ዓይነት:",
    recurring: "ተደጋጋሚ",
    oneTime: "ሓደ ግዜ",
    methodLabel: "ኣገባብ ክፍሊት:",
    methodValue: "ሕሳብ ባንኪ (ACH)",
    importantLabel: "ኣገዳሲ:",
    importantText: "ናይ ACH ክፍሊታት ብተለምዶ ንምስራሕ 3-5 ናይ ስራሕ መዓልትታት ይወስድ። ክፍሊት ምስ ተሰርሐ ናይ መረጋገጺ ኢመይል ክትቕበሉ ኢኹም።",
    securityLabel: "ውሕስነት:",
    securityText: "ሓበሬታ ሕሳብ ባንክኹም ተመስጢሩን ብውሑስ መንገዲን ይስራሕ። ንዝርዝር ሕሳብኩም ኣብ ሰርቨርና ኣይንዕቅቦን ኢና።",
    cancel: "ሰርዝ",
    processing: "ይካየድ ኣሎ...",
    pay: "ክፈል ${amount}",
    errors: {
      stripeNotLoaded: "Stripe ገና ኣይተጻዕነን። በጃኹም ደጊምኩም ፈትኑ።",
      fillRequired: "በጃኹም ኩሉ ዘድሊ ሓበሬታ ሕሳብ ባንኪ ምልኡ።",
      routingLength: "ራውቲንግ ቁጽሪ 9 ኣሃዝ ክኸውን ኣለዎ።",
      accountLength: "ቁጽሪ ሕሳብ እንተወሓደ 4 ኣሃዝ ክኸውን ኣለዎ።",
      achFailed: "ናይ ACH መረጋገጺ ኣይተኻእለን",
      unexpected: "ዘይተጸበኹሞ ጌጋ ተፈጢሩ"
    }
  },

  // ==== StripePayment (Phase 2a) — DRAFT, pending native review ====
  stripePayment: {
    cardInformation: "ሓበሬታ ካርድ",
    cardAriaLabel: "ናይ ክረዲት ወይ ዴቢት ካርድ ሓበሬታ",
    nameOnCard: "ኣብ ካርድ ዘሎ ስም",
    nameOnCardPlaceholder: "ኣብ ካርድ ከምዘሎ ምሉእ ስም",
    paymentInformation: "ሓበሬታ ክፍሊት",
    errors: {
      paymentFailed: "ክፍሊት ኣይተዓወተን",
      notSuccessful: "ክፍሊት ኣይተዓወተን። በጃኹም ደጊምኩም ፈትኑ።"
    }
  },

  // ==== Batch 2b: Departments & Meetings — DRAFT, pending native review ====
  // -- DepartmentsPage (listing / browse) --
  "departmentsPage.backToDashboard": "ናብ ዳሽቦርድ ተመለስ",
  "departmentsPage.title": "ክፍልታት ስራሕን ኣገልግሎትን",
  "departmentsPage.subtitle": "ክፍልታት ስራሕኩም ርኣዩ ወይ ንኸተገልግሉ ዘኽእሉ ዕድላት ኣናድዩ",
  "departmentsPage.myTab": "ክፍልታት ስራሕይ",
  "departmentsPage.browseTab": "ኩሎም ርአ",
  "departmentsPage.members": "ኣባላት",
  "departmentsPage.viewDetails": "ዝርዝር ርአ",
  "departmentsPage.requestToJoin": "ንምጽንባር ሕተት",
  "departmentsPage.requestComingSoon": "ናይ ምጽንባር ሕቶ ኣገልግሎት ኣብ ቀረባ ግዜ ክመጽእ እዩ!",
  "departmentsPage.emptyMyTitle": "ዝኾነ ክፍሊ ስራሕ ኣይተረኽበን",
  "departmentsPage.emptyAllTitle": "ዝርከብ ክፍሊ ስራሕ የለን",
  "departmentsPage.emptyMyDesc": "ገና ናብ ዝኾነ ክፍሊ ስራሕ ኣይተጸንበርኩምን። ክተገልግሉሉ እትኽእሉ ንምርካብ ምሉእ ዝርዝር ኣስሱ።",
  "departmentsPage.emptyAllDesc": "ሕጂ ንምጽንባር ዝኸውን ንጡፍ ክፍሊ ስራሕ የለን።",
  "departmentsPage.browseDepartments": "ክፍልታት ስራሕ ኣስስ",

  // -- Department type labels (data enum) --
  "departmentType.ministry": "ኣገልግሎት",
  "departmentType.committee": "ኮሚቴ",
  "departmentType.service": "ግልጋሎት",
  "departmentType.social": "ማሕበራዊ",
  "departmentType.administrative": "ምምሕዳራዊ",

  // -- DepartmentDashboard (migrated from legacy + new) --
  "department.tabs.meetings": "ኣኼባታት",
  "department.tabs.tasks": "ትልምታት",
  "department.tabs.members": "ኣባላት",
  "department.addMeeting": "ኣኼባ ወስኽ",
  "department.addTask": "ትልሚ ወስኽ",
  "department.manageMembers": "ኣባላት ኣመሓድር",
  "department.backToDashboard": "ናብ ዳሽቦርድ ተመለስ",
  "department.notFound": "ክፍሊ ስራሕ ኣይተረኽበን",
  "department.loadFailed": "ክፍሊ ስራሕ ምርካብ ኣይተኻእለን",
  "department.leader": "መራሒ:",
  "department.roleMember": "ኣባል",
  "department.noMembers": "ገና ኣባላት የለዉን",
  "department.attendees": "ተሳተፍቲ",
  "department.noMeetings": "ገና ዝተመዝገበ ኣኼባ የለን",
  "department.createFirstMeeting": "ናይ መጀመርታ ኣኼባኻ ፍጠር",
  "department.due": "ክዛዘም ዘለዎ:",
  "department.edit": "ኣርም",
  "department.noTasks": "ገና ትልምታት የለዉን",

  // -- Task status / priority labels (data enums) --
  "taskStatus.pending": "ዘይተጀመረ",
  "taskStatus.in_progress": "ኣብ መስርሕ",
  "taskStatus.completed": "ተዛዚሙ",
  "taskStatus.cancelled": "ተሰሪዙ",
  "taskStatus.rejected": "ተነጺጉ",
  "taskPriority.low": "ትሑት",
  "taskPriority.medium": "ማእከላይ",
  "taskPriority.high": "ላዕለዋይ",
  "taskPriority.urgent": "ህጹጽ",

  // -- AddMeetingModal --
  "meetingModal.editTitle": "ኣኼባ ኣርም",
  "meetingModal.createTitle": "ሓድሽ ኣኼባ መደብ",
  "meetingModal.keyboard": "ኪቦርድ:",
  "meetingModal.englishLatin": "እንግሊዝኛ (ላቲን)",
  "meetingModal.title": "ርእሲ ኣኼባ",
  "meetingModal.dateTime": "ዕለትን ሰዓትን",
  "meetingModal.location": "ቦታ",
  "meetingModal.purpose": "ዕላማ",
  "meetingModal.agenda": "ኣጀንዳ",
  "meetingModal.attendees": "ተሳተፍቲ",
  "meetingModal.notes": "ቃለ ጉባኤ / ትሕዝቶ",
  "meetingModal.cancel": "ሰርዝ",
  "meetingModal.saving": "ይዕቀብ ኣሎ...",
  "meetingModal.update": "ኣኼባ ኣሐድስ",
  "meetingModal.create": "ኣኼባ ፍጠር",
  "meetingModal.saveFailed": "ኣኼባ ምዕቃብ ኣይተኻእለን",
  "meetingModal.genericError": "ጌጋ ተፈጢሩ",

  // -- AddTaskModal --
  "taskModal.editTitle": "ትልሚ ኣርም",
  "taskModal.createTitle": "ሓድሽ ትልሚ ፍጠር",
  "taskModal.objective": "ዕላማ",
  "taskModal.objectivePlaceholder": "ሓጺር መግለጺ ናይቲ ትልሚ",
  "taskModal.description": "መግለጺ",
  "taskModal.descriptionPlaceholder": "ዝርዝር መግለጺ...",
  "taskModal.status": "ኩነታት",
  "taskModal.priority": "ቀዳምነት",
  "taskModal.assignedTo": "ዝተመደበሉ",
  "taskModal.unassigned": "ዘይተመደበ",
  "taskModal.startDate": "መጀመሪ ዕለት",
  "taskModal.endDate": "መወዳእታ ዕለት",
  "taskModal.rejectedDate": "ዝተነጽገሉ ዕለት",
  "taskModal.notes": "መዘኻኸሪ",
  "taskModal.notesPlaceholder": "ተወሳኺ መዘኻኸሪ...",
  "taskModal.cancel": "ሰርዝ",
  "taskModal.saving": "ይዕቀብ ኣሎ...",
  "taskModal.update": "ትልሚ ኣሐድስ",
  "taskModal.create": "ትልሚ ፍጠር",
  "taskModal.rejectedDateRequired": "ኩነታት ተነጺጉ ኮይኑ ዝተነጽገሉ ዕለት የድሊ",
  "taskModal.saveFailed": "ትልሚ ምዕቃብ ኣይተኻእለን",
  "taskModal.genericError": "ጌጋ ተፈጢሩ",

  // -- MeetingDetailsPage / MeetingEmailModal (migrated from legacy + new) --
  "meeting.tasks.previous": "ናይ ዝሓለፈ ኣኼባ ትልምታት",
  "meeting.tasks.actionItems": "ናይዚ ኣኼባ ትልምታት",
  "meeting.tasks.add": "ትልሚ ወስኽ",
  "meeting.tasks.none": "ገና ዝተወጠነ ትልሚ የለን",
  "meeting.agenda": "ኣጀንዳ",
  "meeting.minutes": "ቃለ ጉባኤ",
  "meeting.attendees": "ተሳተፍቲ",
  "meeting.assignedTo": "ሓላፍነት ዝወሰደ",
  "meeting.due": "ክዛዘም ዘለዎ",
  "meeting.notFound": "ኣኼባ ኣይተረኽበን",
  "meeting.loadFailed": "ኣኼባ ምርካብ ኣይተኻእለን",
  "meeting.backToDepartment": "ናብ ክፍሊ ስራሕ ተመለስ",
  "meeting.editMeeting": "ኣኼባ ኣርም",
  "meeting.editTask": "ትልሚ ኣርም",
  "meeting.print.savePdf": "ሕተም / PDF ኣድሕን",
  "meeting.print.record": "መዝገብ ኣኼባ",
  "meeting.print.overview": "ሓፈሻዊ ሓበሬታ ኣኼባ",
  "meeting.print.department": "ክፍሊ ስራሕ",
  "meeting.print.date": "ዕለት",
  "meeting.print.location": "ቦታ",
  "meeting.print.purpose": "ዕላማ",
  "meeting.print.generated": "ዝተፈጥረ",
  "meeting.print.language.english": "እንግሊዝኛ",
  "meeting.print.language.tigrinya": "ትግርኛ",
  "meeting.print.notProvided": "ኣይተዋህበን",
  "meeting.print.noAttendees": "ተሳተፍቲ ኣይተመዝገቡን",
  "meeting.email.button": "ንኣባላት ኢመይል ስደድ",
  "meeting.email.modalTitle": "ቃለ ጉባኤ ብኢመይል ስደድ",
  "meeting.email.recipients": "ተቐበልቲ",
  "meeting.email.skipped": "ዝተሓለፉ",
  "meeting.email.subject": "ኣርእስቲ",
  "meeting.email.body": "መልእኽቲ",
  "meeting.email.send": "ኢመይል ስደድ",
  "meeting.email.sending": "ይስደድ ኣሎ...",
  "meeting.email.cancel": "ሰርዝ",
  "meeting.email.noRecipients": "ኣብዚ ክፍሊ ስራሕ ዘለዉ ኣባላት ዘረጋገጸ ኢመይል የብሎምን።",
  "meeting.email.previewFailed": "ቅድመ እይታ ኢመይል ምጽዓን ኣይተኻእለን",
  "meeting.email.loadingPreview": "ቅድመ እይታ ኢመይል ይጽዕን ኣሎ…",
  "meeting.email.sendFailed": "ኢመይል ኣኼባ ምስዳድ ኣይተኻእለን",
  "meeting.email.sentSummary": "ዘረጋገጸ ኢመይል ዘይብሎም ኣባላት ተሓሊፎም።",
  "meeting.email.reason.missing": "ኣብ መዝገብ ኢመይል የለን",
  "meeting.email.reason.invalid": "ዘይቅቡል ኣድራሻ ኢመይል",

  // ==== Batch 2d (wave A): misc / auth small components — DRAFT, pending native review ====
  "creditsPage.title": "ናይ ቴክኒክ ጉጅለ / ኣፍልጦ",

  "parishPulse.title": "Parish Pulse ምዝገባ",
  "parishPulse.description": "ካብ ማሕበርና ኣገደስቲ ናይ SMS መልእኽትታትን ሓበሬታን ንምቕባል ተመዝገቡ። ኣብ ዝኾነ እዋን ናብ ዝኾነ መልእኽቲ \"STOP\" ብምምላስ ክትቋረጹ ትኽእሉ።",
  "parishPulse.thankYou": "ስለዝተመዝገብኩም የቐንየልና! ኣብ ቀረባ ግዜ ናይ SMS ሓበሬታ ክትቕበሉ ኢኹም።",
  "parishPulse.errorRequired": "በጃኹም ሽምኩምን ቁጽሪ ሞባይልኩምን ኣእትዉ።",
  "parishPulse.fullName": "ምሉእ ስም",
  "parishPulse.namePlaceholder": "ሽምኩም",
  "parishPulse.mobileNumber": "ቁጽሪ ሞባይል",
  "parishPulse.phonePlaceholder": "ኣብነት፦ (555) 123-4567",
  "parishPulse.submit": "ተመዝገብ",
  "parishPulse.disclaimer": "ቁጽሪ ሞባይልኩም ብምእታው፡ ካብ Tigray Orthodox Church ናይ SMS መልእኽቲ ንምቕባል ትሰማምዑ ኣለኹም። ናይ መልእኽትን ዳታን ክፍሊት ክህሉ ይኽእል። ንምቁራጽ STOP ብምባል መልሱ።",

  "protectedRoute.retry": "ደጊምካ ፈትን",
  "protectedRoute.goToRegistration": "ናብ ምዝገባ ኪድ",

  "liveEmbed.liveStream": "ቀጥታ ስርጭት",
  "liveEmbed.unmute": "ድምጺ ክፈት",
  "liveEmbed.mute": "ድምጺ ዕጾ",
  "liveEmbed.unmuteAria": "ናይ ቀጥታ ስርጭት ድምጺ ክፈት",
  "liveEmbed.muteAria": "ናይ ቀጥታ ስርጭት ድምጺ ዕጾ",
  "liveEmbed.fallbackPrefix": "እቲ ስርጭት ብቐጥታ እንተዘይጀሚሩ፡ ",
  "liveEmbed.openOnYouTube": "ኣብ YouTube ናይ ቀጥታ ገጽ ክፈት",

  "transliterationHelp.title": "መምርሒ ናይ ግእዝ ኣጸሓሕፋ",
  "transliterationHelp.instruction": "ተመሳሳሊ ናይ ግእዝ ፊደል ንምርካብ ናይ ላቲን ፊደላት ጸሓፍ።",
  "transliterationHelp.close": "ዕጾ",

  // ==== Batch 2d: RegistrationSteps (remaining hardcoded strings) — DRAFT, pending native review ====
  "registration.emailExists": "በዚ ኢመይል ዝተመዝገበ ኣባል ኣሎ። ኮይኑ ግና ክትቕጽሉ ትኽእሉ ኢኹም።",
  "registration.yearlyPledgeLabel": "ዓመታዊ ናይ ኣባልነት ቃል (USD)",
  "registration.yearlyPledgePlaceholder": "ኣብነት፦ 1200",
  "registration.yearlyPledgeHelp": "እዚ ወርሓዊ ክፍሊትኩም ንምውሳንን ክፍሊታት ንምክትታልን ይሕግዘና።",
  "registration.selectRelationship": "ዝምድና ምረጽ",

  // ==== Batch 2c: admin / finance — DRAFT, pending native review ====
  // -- BankUpload --
  "bankUpload.title": "ናይ ባንክ መግለጺ ጽዓን",
  "bankUpload.selectFile": "ናይ Chase CSV ፋይል ምረጽ",
  "bankUpload.uploading": "ይጽዓን ኣሎ...",
  "bankUpload.upload": "ጽዓንን ኣካይድን",
  "bankUpload.uploadFailed": "ምጽዓን ኣይተኻእለን",
  "bankUpload.success": "ብዓወት ተጻዒኑ!",
  "bankUpload.imported": "ዝኣተዉ፦ {count} ሓደስቲ ልውውጣት",
  "bankUpload.skipped": "ዝተሓለፉ፦ {count} ድግማት",
  "bankUpload.autoReconciled": "ብቐጥታ ዝተዓረቑ፦ {count} ካብ {examined} ተጸበይቲ",
  "bankUpload.autoLinked": "ምስ ዘለዉ ክፍሊታት ዝተኣሳሰሩ (ንኣብነት Zelle ኣውቶሜሽን)፦ {count}",
  "bankUpload.autoMember": "ካብ ዝተማህሩ ከፈልቲ ዝተፈጥሩ ክፍሊታት ኣባላት፦ {count}",
  "bankUpload.autoExpense": "ካብ ዝተማህሩ ተቐበልቲ ዝተመዝገቡ ወጻኢታት፦ {count}",
  "bankUpload.needsReview": "ንግምገማ ዝተረፉ፦ {count}",
  "bankUpload.errors": "ጌጋታት፦ {count}",
  "bankUpload.supportedFormat": "ዝድገፍ ቅርጺ፦ Chase Activity CSV። እቲ ስርዓት ብቐጥታ ናይ Zelle ወሃብቲ የለሊ ከምኡውን ዝተደገሙ ልውውጣት ይሓልፍ።",
  "bankUpload.autoDeferred": "ዓቢ ምጽዓን፦ ምጽዓን ቅልጡፍ ንኽኸውን ኣውቶማቲክ ዕርቂ ተሓሊፉ። ኣብ ናይ ባንክ ልውውጣት ዘሎ \"ተጸበይቲ ኣወሃህድ\" መልጎም ተጠቐሙ።",

  // -- Bank transactions: on-demand auto-reconcile --
  "bankTransactions.autoReconcile": "ተጸበይቲ ኣወሃህድ",
  "bankTransactions.autoReconciling": "የወሃህድ ኣሎ…",
  "bankTransactions.autoReconcileHelp": "ኩሎም ተጸበይቲ ልውውጣት ኣንጻር ዝፍለጡ ከፈልቲ፡ ተቐበልትን ናይ Zelle መወከሲታትን ደጊምካ ፈትሽ። ብዝተወሰኑ ጉጅለታት ይሰርሕ።",
  "bankTransactions.autoReconcileDone": "{examined} ተጸበይቲ ልውውጣት ተፈቲሾም፤ {matched} ብቐጥታ ተወሃሂዶም ወይ ተመዝጊቦም።",
  "bankTransactions.autoReconcileFailed": "ኣውቶማቲክ ዕርቂ ኣይተዓወተን",

  // -- Member Information report (Payment Reports tab) --
  "memberInfoReport.type": "ሓበሬታ ኣባላት",
  "memberInfoReport.title": "ጸብጻብ ሓበሬታ ኣባላት",
  "memberInfoReport.generated": "ዝተፈጥረ",
  "memberInfoReport.activeMembers": "ንጡፋት ኣባላት",
  "memberInfoReport.colId": "መለለዪ",
  "memberInfoReport.colFirstName": "ስም ቀዳማይ",
  "memberInfoReport.colLastName": "ስም ኣቦ",
  "memberInfoReport.colPhone": "ስልኪ",
  "memberInfoReport.colSpouseFirst": "ስም መጻምዲ",
  "memberInfoReport.colSpouseLast": "ስም ኣቦ መጻምዲ",
  "memberInfoReport.colSpousePhone": "ስልኪ መጻምዲ",

  // -- Admin Member Reports tab --
  "memberReports.tab": "ጸብጻባት",
  "memberReports.selectLabel": "ጸብጻብ",
  "memberReports.memberInformation": "ሓበሬታ ኣባላት",
  "memberReports.householdDirectory": "መዝገብ ኣባልነት ስድራቤት",

  // -- Household Membership Directory report --
  "householdReport.title": "መዝገብ ኣባልነት ስድራቤት",
  "householdReport.sortBy": "ብ... ሰርዕ",
  "householdReport.sortLastName": "ስም ኣቦ",
  "householdReport.sortFirstName": "ቀዳማይ ስም",
  "householdReport.savePdf": "ከም PDF ኣቐምጥ",
  "householdReport.summaryTitle": "ጽማቕ ኣባልነት",
  "householdReport.totalFamilies": "ጠቕላላ ስድራቤታት",
  "householdReport.totalParishMembers": "ጠቕላላ ኣባላት ቤተ ክርስቲያን",
  "householdReport.totalHeads": "ሓለፍቲ ስድራቤት",
  "householdReport.totalSpouses": "መጻምድቲ",
  "householdReport.totalDependents": "ጠቕላላ ተደገፍቲ",
  "householdReport.generatedOn": "ዝተፈጥረሉ ዕለት",
  "householdReport.generatedBy": "ዘውጽኦ",
  "householdReport.headOfHousehold": "ሓላፊ ስድራቤት",
  "householdReport.spouse": "መጻምዲ",
  "householdReport.dependentsSection": "ተደገፍቲ",
  "householdReport.householdMembers": "ኣባላት ስድራቤት",
  "householdReport.mobile": "ሞባይል",
  "householdReport.memberId": "መለለዪ ኣባል",
  "householdReport.noResults": "ስድራቤት ኣይተረኽበን።",
  "householdReport.page": "ገጽ",
  "householdReport.of": "ካብ",
  "householdReport.previous": "ዝሓለፈ",
  "householdReport.next": "ቀጻሊ",

  // -- MonthlyBankSummary --
  "monthlyBankSummary.title": "ወርሓዊ ጽማቕ",
  "monthlyBankSummary.subtitle": "ካብ ናይ ባንክ ንጥፈት እቶትን ወጻኢን፡ ናይ መወዳእታ {count} ኣዋርሕ",
  "monthlyBankSummary.showLast6": "ናይ መወዳእታ 6 ኣዋርሕ ኣርኢ",
  "monthlyBankSummary.showLast12": "ናይ መወዳእታ 12 ኣዋርሕ ኣርኢ",
  "monthlyBankSummary.colMonth": "ወርሒ",
  "monthlyBankSummary.colIncome": "ጠቕላላ እቶት",
  "monthlyBankSummary.colExpense": "ጠቕላላ ወጻኢ",
  "monthlyBankSummary.colNet": "ተረፍ ትርፊ/(ጉድለት)",
  "monthlyBankSummary.colBalance": "መዛዘሚ ሚዛን",
  "monthlyBankSummary.colStatus": "ኩነታት",
  "monthlyBankSummary.loading": "ይጽዕን ኣሎ...",
  "monthlyBankSummary.empty": "ኣብ ናይ መወዳእታ 12 ኣዋርሕ ናይ ባንክ ንጥፈት የለን። ንምጅማር ናይ ባንክ መግለጺ ጽዓን።",
  "monthlyBankSummary.reconciled": "ተዓሪቑ",
  "monthlyBankSummary.pending": "{count} ተጸበይቲ",
  "monthlyBankSummary.awaitingReview": "{pending} ካብ {total} ልውውጣት ንግምገማ ይጽበዩ",

  // -- ActivityLogViewer --
  "activityLog.loadFailed": "ናይ ንጥፈት መዝገባት ምጽዓን ኣይተኻእለን",
  "activityLog.title": "ናይ ንጥፈት መዝገባት",
  "activityLog.allActions": "ኩሎም ተግባራት",
  "activityLog.allTypes": "ኩሎም ዓይነታት",
  "activityLog.entityMember": "ኣባል",
  "activityLog.entityDonation": "ልገሳ",
  "activityLog.entityPayment": "ክፍሊት",
  "activityLog.refresh": "ኣሐድስ",
  "activityLog.loading": "መዝገባት ይጽዕን ኣሎ...",
  "activityLog.colDate": "ዕለት",
  "activityLog.colUser": "ተጠቃሚ",
  "activityLog.colAction": "ተግባር",
  "activityLog.colEntity": "ኣካል",
  "activityLog.colDetails": "ዝርዝራት",
  "activityLog.empty": "ዝኾነ ናይ ንጥፈት መዝገብ ኣይተረኽበን።",
  "activityLog.systemUnknown": "ስርዓት / ዘይተፈልጠ",
  "activityLog.pageOf": "ገጽ {page} ካብ {total}",
  "activityLog.previous": "ዝሓለፈ",
  "activityLog.next": "ቀጻሊ",

  // -- MemberSearch --
  "memberSearch.title": "ኣባላት ድለ",
  "memberSearch.subtitle": "ክፍሊታቶምን ታሪኽ ክፍሊቶምን ንምርኣይ ኣባል ምረጽ",
  "memberSearch.placeholder": "ብስም፡ ኢመይል፡ ስልኪ ወይ ናይ ኣባል መለለዪ ድለ...",
  "memberSearch.loading": "ኣባላት ይጽዕን ኣሎ...",
  "memberSearch.noMembersTitle": "ኣባላት ኣይተረኽቡን",
  "memberSearch.adjustSearch": "ናይ ምድላይ ቃላትኩም ኣስተኻኽሉ።",
  "memberSearch.noneAvailable": "ዝርከቡ ኣባላት የለዉን።",
  "memberSearch.noPledge": "ቃል የለን",
  "memberSearch.perYear": "/ዓመት",
  "memberSearch.found": "{count} ኣባላት ተረኺቦም",
  "memberSearch.cancel": "ሰርዝ",

  // -- PaymentList --
  "paymentList.searchLabel": "ኣባላት ድለ",
  "paymentList.searchPlaceholder": "ብስም ወይ ናይ ኣባል መለለዪ ድለ...",
  "paymentList.statusFilter": "ናይ ኩነታት መጻረዪ",
  "paymentList.filterAll": "ኩሎም ኣባላት",
  "paymentList.filterUpToDate": "ኣብ ግዜኡ ዝኸፈለ",
  "paymentList.filterBehind": "ብክፍሊት ዝደንጎየ",
  "paymentList.filterPartial": "ኸፊላዊ ክፍሊት",
  "paymentList.applyFilters": "መጻረዪታት ተግብር",
  "paymentList.colMember": "ኣባል",
  "paymentList.colContact": "መራኸቢ",
  "paymentList.colMonthly": "ወርሓዊ ክፍሊት",
  "paymentList.colTotalDue": "ጠቕላላ ዘለዎ",
  "paymentList.colCollected": "ዝተኣከበ",
  "paymentList.colBalance": "ተረፍ",
  "paymentList.colStatus": "ኩነታት",
  "paymentList.spouse": "መጻምዲ:",
  "paymentList.statusNoDues": "ክፍሊት የለን",
  "paymentList.statusUpToDate": "ኣብ ግዜኡ",
  "paymentList.statusPartial": "ኸፊላዊ",
  "paymentList.statusBehind": "ዝደንጎየ",
  "paymentList.pageOf": "ገጽ {page} ካብ {total}",
  "paymentList.previous": "ዝሓለፈ",
  "paymentList.next": "ቀጻሊ",

  // -- LoansPage --
  "loansPage.statOutstanding": "ጠቕላላ ዘይተኸፍለ",
  "loansPage.statActive": "ንጡፋት ልቓሓት",
  "loansPage.statPartial": "ኸፊላዊ ዝተኸፍለ",
  "loansPage.statLoaned": "ጠቕላላ ዝተለቓሕ",
  "loansPage.recordLoan": "ልቓሕ መዝግብ",
  "loansPage.allStatuses": "ኩሎም ኩነታት",
  "loansPage.statusActive": "ንጡፍ",
  "loansPage.statusPartiallyRepaid": "ኸፊላዊ ዝተኸፍለ",
  "loansPage.statusClosed": "ዝተዓጽወ",
  "loansPage.startDate": "መጀመሪ ዕለት",
  "loansPage.endDate": "መወዳእታ ዕለት",
  "loansPage.loanCount": "{count} ልቓሓት",
  "loansPage.warning": "እዚኦም ናይ ዕዳ መዛግብቲ እዮም — ካብ ኣባላት ዝተወስዱ ልቓሓት። ልገሳ ኣይኮኑን ከምኡውን ካብ ግብሪ ዝንኪ ኣይኮኑን።",
  "loansPage.colMember": "ኣባል",
  "loansPage.colLoanDate": "ዕለት ልቓሕ",
  "loansPage.colOriginal": "መበቆላዊ መጠን",
  "loansPage.colOutstanding": "ዘይተኸፍለ",
  "loansPage.colStatus": "ኩነታት",
  "loansPage.colMethod": "መገዲ ክፍሊት",
  "loansPage.colReceipt": "ቁጽሪ ቅብሊት",
  "loansPage.colActions": "ተግባራት",
  "loansPage.loading": "ይጽዕን ኣሎ...",
  "loansPage.empty": "ልቓሓት ኣይተረኽቡን",
  "loansPage.btnRepayment": "ምምላስ",
  "loansPage.btnReceipt": "ቅብሊት",
  "loansPage.previous": "ዝሓለፈ",
  "loansPage.next": "ቀጻሊ",
  "loansPage.pageOf": "ገጽ {page} ካብ {total}",

  // -- VendorList / VendorFormModal (shared vendor domain) --
  "vendorList.loadFailed": "ኣቕረብቲ ምጽዓን ኣይተኻእለን",
  "vendorList.confirmDelete": "ብርግጽ ን{name} ክትድምስሱ ትደልዩ ዲኹም?",
  "vendorList.deleteFailed": "ኣቕራቢ ምድምሳስ ኣይተኻእለን",
  "vendorList.deleteError": "ኣቕራቢ ኣብ ምድምሳስ ጌጋ ኣጋጢሙ",
  "vendorList.title": "ምሕደራ ኣቕረብቲ",
  "vendorList.subtitle": "ኣቕረብትን ወሃብትን ኣመሓድር",
  "vendorList.add": "ኣቕራቢ ወስኽ",
  "vendorList.search": "ድለ",
  "vendorList.searchPlaceholder": "ብስም፡ መራኸቢ ወይ ቁጽሪ ሕሳብ ድለ...",
  "vendorList.typeLabel": "ዓይነት ኣቕራቢ",
  "vendorList.allTypes": "ኩሎም ዓይነታት",
  "vendorList.typeUtility": "ኣገልግሎት (ውሃ/ሓይሊ)",
  "vendorList.typeSupplier": "ኣቕራቢ ኣቕሑ",
  "vendorList.typeServiceProvider": "ወሃቢ ኣገልግሎት",
  "vendorList.typeContractor": "ተቖራጻይ",
  "vendorList.typeLender": "ኣለቓሒ",
  "vendorList.typeOther": "ካልእ",
  "vendorList.statusLabel": "ኩነታት",
  "vendorList.allStatus": "ኩሉ ኩነታት",
  "vendorList.statusActive": "ንጡፍ",
  "vendorList.statusInactive": "ዘይንጡፍ",
  "vendorList.empty": "ኣቕረብቲ ኣይተረኽቡን",
  "vendorList.colName": "ስም ኣቕራቢ",
  "vendorList.colType": "ዓይነት",
  "vendorList.colContact": "መራኸቢ",
  "vendorList.colAccount": "ቁጽሪ ሕሳብ",
  "vendorList.colTerms": "ውዕል ክፍሊት",
  "vendorList.colStatus": "ኩነታት",
  "vendorList.colActions": "ተግባራት",
  "vendorList.edit": "ኣርም",
  "vendorList.delete": "ደምስስ",

  // -- VendorFormModal --
  "vendorForm.errorNameRequired": "ስም ኣቕራቢ የድሊ",
  "vendorForm.errorEmail": "በጃኹም ቅቡል ኣድራሻ ኢመይል ኣእትዉ",
  "vendorForm.errorWebsite": "በጃኹም ቅቡል ናይ ወብሳይት URL ኣእትዉ (ብhttp:// ወይ https:// ዝጅምር)",
  "vendorForm.saveFailedUpdate": "ኣቕራቢ ምሕዳስ ኣይተኻእለን",
  "vendorForm.saveFailedCreate": "ኣቕራቢ ምፍጣር ኣይተኻእለን",
  "vendorForm.saveError": "ኣቕራቢ ኣብ ምዕቃብ ጌጋ ኣጋጢሙ",
  "vendorForm.editTitle": "ኣቕራቢ ኣርም",
  "vendorForm.addTitle": "ኣቕራቢ ወስኽ",
  "vendorForm.editSubtitle": "ሓበሬታ ኣቕራቢ ኣሐድስ",
  "vendorForm.addSubtitle": "ናብ ስርዓት ሓድሽ ኣቕራቢ ወስኽ",
  "vendorForm.name": "ስም ኣቕራቢ",
  "vendorForm.type": "ዓይነት ኣቕራቢ",
  "vendorForm.contactInfo": "ናይ መራኸቢ ሓበሬታ",
  "vendorForm.contactPerson": "መራኸቢ ሰብ",
  "vendorForm.email": "ኢመይል",
  "vendorForm.phone": "ቁጽሪ ስልኪ",
  "vendorForm.website": "ወብሳይት",
  "vendorForm.address": "ኣድራሻ",
  "vendorForm.businessDetails": "ናይ ንግዲ ዝርዝራት",
  "vendorForm.accountNumber": "ቁጽሪ ሕሳብ",
  "vendorForm.accountPlaceholder": "ናይ ቤተ ክርስቲያን ቁጽሪ ሕሳብ ምስ ኣቕራቢ",
  "vendorForm.paymentTerms": "ውዕል ክፍሊት",
  "vendorForm.paymentTermsPlaceholder": "ኣብነት፦ Net 30፡ ኣብ ምቕባል",
  "vendorForm.taxId": "ናይ ግብሪ መለለዪ / EIN",
  "vendorForm.taxIdPlaceholder": "ናይ ኣቕራቢ ግብሪ መለለዪ ወይ EIN",
  "vendorForm.activeVendor": "ንጡፍ ኣቕራቢ",
  "vendorForm.notes": "መዘኻኸሪ",
  "vendorForm.notesPlaceholder": "ብዛዕባ እዚ ኣቕራቢ ተወሳኺ መዘኻኸሪ...",
  "vendorForm.cancel": "ሰርዝ",
  "vendorForm.saving": "ይዕቀብ ኣሎ...",
  "vendorForm.update": "ኣቕራቢ ኣሐድስ",

  // -- EmployeeList / EmployeeFormModal (shared employee domain) --
  "employeeList.loadFailed": "ሰራሕተኛታት ምጽዓን ኣይተኻእለን",
  "employeeList.confirmDelete": "ብርግጽ ን{name} ክትድምስሱ ትደልዩ ዲኹም?",
  "employeeList.deleteFailed": "ሰራሕተኛ ምድምሳስ ኣይተኻእለን",
  "employeeList.deleteError": "ሰራሕተኛ ኣብ ምድምሳስ ጌጋ ኣጋጢሙ",
  "employeeList.title": "ምሕደራ ሰራሕተኛታት",
  "employeeList.subtitle": "ሰራሕተኛታት ቤተ ክርስቲያን ኣመሓድር",
  "employeeList.add": "ሰራሕተኛ ወስኽ",
  "employeeList.search": "ድለ",
  "employeeList.searchPlaceholder": "ብስም፡ ኢመይል ወይ ስራሕ ድለ...",
  "employeeList.typeLabel": "ዓይነት ስራሕ",
  "employeeList.allTypes": "ኩሎም ዓይነታት",
  "employeeList.typeFullTime": "ምሉእ ሰዓት",
  "employeeList.typePartTime": "ፍርቂ ሰዓት",
  "employeeList.typeContract": "ኮንትራት",
  "employeeList.typeVolunteer": "ወለንተኛ",
  "employeeList.statusLabel": "ኩነታት",
  "employeeList.allStatus": "ኩሉ ኩነታት",
  "employeeList.statusActive": "ንጡፍ",
  "employeeList.statusInactive": "ዘይንጡፍ",
  "employeeList.empty": "ሰራሕተኛታት ኣይተረኽቡን",
  "employeeList.colName": "ስም",
  "employeeList.colPosition": "ስራሕ",
  "employeeList.colType": "ዓይነት ስራሕ",
  "employeeList.colSalary": "ደሞዝ",
  "employeeList.colStatus": "ኩነታት",
  "employeeList.colActions": "ተግባራት",
  "employeeList.edit": "ኣርም",
  "employeeList.delete": "ደምስስ",
  "employeeList.freqWeekly": "ሰሙናዊ",
  "employeeList.freqBiWeekly": "ክልተ ሰሙናዊ",
  "employeeList.freqMonthly": "ወርሓዊ",
  "employeeList.freqAnnual": "ዓመታዊ",
  "employeeList.freqPerService": "ብኣገልግሎት",

  // -- EmployeeFormModal --
  "employeeForm.errorFirstName": "ስም ቀዳማይ የድሊ",
  "employeeForm.errorLastName": "ስም ኣቦ የድሊ",
  "employeeForm.errorEmail": "በጃኹም ቅቡል ኣድራሻ ኢመይል ኣእትዉ",
  "employeeForm.errorSsn": "ናይ SSN መወዳእታ ኣርባዕተ ልክዕ 4 ኣሃዛት ክኸውን ኣለዎ",
  "employeeForm.saveFailedUpdate": "ሰራሕተኛ ምሕዳስ ኣይተኻእለን",
  "employeeForm.saveFailedCreate": "ሰራሕተኛ ምፍጣር ኣይተኻእለን",
  "employeeForm.saveError": "ሰራሕተኛ ኣብ ምዕቃብ ጌጋ ኣጋጢሙ",
  "employeeForm.editTitle": "ሰራሕተኛ ኣርም",
  "employeeForm.addTitle": "ሰራሕተኛ ወስኽ",
  "employeeForm.editSubtitle": "ሓበሬታ ሰራሕተኛ ኣሐድስ",
  "employeeForm.addSubtitle": "ናብ ስርዓት ሓድሽ ሰራሕተኛ ወስኽ",
  "employeeForm.firstName": "ስም ቀዳማይ",
  "employeeForm.lastName": "ስም ኣቦ",
  "employeeForm.position": "ስራሕ",
  "employeeForm.positionPlaceholder": "ኣብነት፦ ቄስ፡ ዲያቆን፡ ጸሓፊ",
  "employeeForm.type": "ዓይነት ስራሕ",
  "employeeForm.contactInfo": "ናይ መራኸቢ ሓበሬታ",
  "employeeForm.email": "ኢመይል",
  "employeeForm.phone": "ቁጽሪ ስልኪ",
  "employeeForm.address": "ኣድራሻ",
  "employeeForm.employmentDetails": "ዝርዝር ስራሕ",
  "employeeForm.hireDate": "ዕለት ቆጸራ",
  "employeeForm.terminationDate": "ዕለት ምቁራጽ",
  "employeeForm.activeEmployee": "ንጡፍ ሰራሕተኛ",
  "employeeForm.compensation": "ክፍሊት",
  "employeeForm.salaryAmount": "መጠን ደሞዝ",
  "employeeForm.salaryFrequency": "ተደጋጋምነት ደሞዝ",
  "employeeForm.selectFrequency": "-- ተደጋጋምነት ምረጽ --",
  "employeeForm.freqWeekly": "ሰሙናዊ",
  "employeeForm.freqBiWeekly": "ክልተ ሰሙናዊ",
  "employeeForm.freqMonthly": "ወርሓዊ",
  "employeeForm.freqAnnual": "ዓመታዊ",
  "employeeForm.freqPerService": "ብኣገልግሎት",
  "employeeForm.taxInfo": "ናይ ግብሪ ሓበሬታ",
  "employeeForm.ssnLastFour": "መወዳእታ 4 ናይ SSN",
  "employeeForm.taxId": "ናይ ግብሪ መለለዪ / EIN",
  "employeeForm.taxIdPlaceholder": "ን 1099 ተቖረጽቲ",
  "employeeForm.notes": "መዘኻኸሪ",
  "employeeForm.notesPlaceholder": "ብዛዕባ እዚ ሰራሕተኛ ተወሳኺ መዘኻኸሪ...",
  "employeeForm.cancel": "ሰርዝ",
  "employeeForm.saving": "ይዕቀብ ኣሎ...",
  "employeeForm.update": "ሰራሕተኛ ኣሐድስ",

  // -- MemberDuesViewer --
  "memberDues.statementFailed": "መግለጺ ምፍጣር ኣይተኻእለን",
  "memberDues.duesFetchFailed": "ናይ ኣባል ክፍሊት ምምጻእ ኣይተኻእለን",
  "memberDues.unableToLoad": "ዳታ ምጽዓን ኣይተኻእለን",
  "memberDues.goBack": "ተመለስ",
  "memberDues.householdFinances": "ናይ ስድራቤት ገንዘብ",
  "memberDues.householdOf": "ናይ {name} ስድራቤት",
  "memberDues.membersCount": "{count} ኣባላት",
  "memberDues.memberFinancialView": "ናይ ኣባል ገንዘባዊ ትርኢት",
  "memberDues.addTransaction": "ልውውጥ ወስኽ",
  "memberDues.clearSelection": "ምርጫ ኣጽሪ",
  "memberDues.close": "ዕጾ",
  "memberDues.financialYear": "ናይ ባጀት ዓመት {year}",
  "memberDues.membershipDues": "ናይ ኣባልነት ክፍሊት",
  "memberDues.annualPledge": "ዓመታዊ ቃል",
  "memberDues.monthlyValue": "ወርሓዊ ዋጋ",
  "memberDues.paidToDate": "ክሳብ ሕጂ ዝተኸፍለ",
  "memberDues.balanceDue": "ዝተረፈ ክፍሊት",
  "memberDues.percentComplete": "{percent}% ተዛዚሙ",
  "memberDues.duesCalcFrom": "ክፍሊት ካብ ዕለት ምጽንባር {name} ናብ ደብሪ ጀሚሩ ይሕሰብ።",
  "memberDues.duesCalcStandard": "ስሌት ኣብ ስሩዕ መጠን ወፈያ ተመስሪቱ",
  "memberDues.totalReceived": "ጠቕላላ ዝተቐበለ",
  "memberDues.yearOverYear": "ካብ ዓመት ናብ ዓመት",
  "memberDues.stableGrowth": "ርጉእ ዕቤት",
  "memberDues.systemId": "መለለዪ ስርዓት",
  "memberDues.additionalContributions": "ዝርዝር ተወሰኽቲ ወፈያታት",
  "memberDues.donations": "ልገሳታት",
  "memberDues.pledges": "ቃላት",
  "memberDues.tithes": "ዕሽር",
  "memberDues.offerings": "መባእ",
  "memberDues.otherContrib": "ካልእ",
  "memberDues.totalAdditional": "ጠቕላላ ተወሳኺ",
  "memberDues.distributionTimeline": "ዓመታዊ ናይ ምክፍፋል ግዜ ሰሌዳ",
  "memberDues.legendPaid": "ዝተኸፍለ",
  "memberDues.legendPending": "ተጸባዪ",
  "memberDues.legendUpcoming": "ዝመጽእ",
  "memberDues.received": "ዝተቐበለ",
  "memberDues.required": "ዘድሊ",
  "memberDues.ledgerTitle": "ዝርዝር መዝገብ ልውውጣት ({year})",
  "memberDues.recordsFound": "{count} መዛግብቲ ተረኺቦም",
  "memberDues.colPostDate": "ዕለት ምዝገባ",
  "memberDues.colReference": "መወከሲ",
  "memberDues.colType": "ዓይነት",
  "memberDues.colMechanism": "መገዲ",
  "memberDues.colOrigin": "መበቆል",
  "memberDues.colAmount": "መጠን",
  "memberDues.emptyLedger": "ን{year} ታሪኻዊ መዛግብቲ ባዶ እዩ",
  "memberDues.authorizedStatement": "ዝተፈቕደ ገንዘባዊ መግለጺ • ዝተፈጥረ {date}",
  "memberDues.generating": "ይፍጠር ኣሎ...",
  "memberDues.printStatement": "መግለጺ ሕተም",
  "memberDues.clearSelectionBtn": "ምርጫ ኣጽሪ",
  "memberDues.finishReview": "ግምገማ ወድእ",

  // -- SmsBroadcast --
  "smsBroadcast.notAuthenticated": "ኣይተረጋገጸን",
  "smsBroadcast.messageRequired": "መልእኽቲ የድሊ",
  "smsBroadcast.messageTooLong": "መልእኽቲ ኣዝዩ ነዊሕ እዩ። በጃኹም ብ{count} ፊደላት ኣጉድሉ።",
  "smsBroadcast.selectMemberError": "በጃኹም ኣባል ምረጹ",
  "smsBroadcast.selectDepartmentError": "በጃኹም ክፍሊ ስራሕ ምረጹ",
  "smsBroadcast.sendFailed": "SMS ምስዳድ ኣይተኻእለን",
  "smsBroadcast.loadDepartmentsFailed": "ክፍልታት ስራሕ ምጽዓን ኣይተኻእለን",
  "smsBroadcast.loadMembersFailed": "ኣባላት ምጽዓን ኣይተኻእለን",
  "smsBroadcast.sentIndividual": "መልእኽቲ ናብቲ ዝተመርጸ ኣባል ብዓወት ተላኢኹ።",
  "smsBroadcast.sentDepartment": "መልእኽቲ ናብ \"{name}\" ክፍሊ ስራሕ ተላኢኹ። ዕዉት፦ {success} / {total}",
  "smsBroadcast.sentPending": "መልእኽቲ ናብ ተጸበይቲ ቃል ዘለዎም ኣባላት ተላኢኹ። ዕዉት፦ {success} / {total}",
  "smsBroadcast.sentFulfilled": "መልእኽቲ ናብ ቃሎም ዝፈጸሙ ኣባላት ተላኢኹ። ዕዉት፦ {success} / {total}",
  "smsBroadcast.sentAll": "ናይ ብሮድካስት ሕቶ ተሰሪዑ። ዕዉት፦ {success} / {total}",
  "smsBroadcast.accessDenied": "መእተዊ ተኸልኪሉ",
  "smsBroadcast.noPermission": "SMS መልእኽትታት ንምስዳድ ፍቓድ የብልኩምን።",
  "smsBroadcast.title": "SMS መራኸቢ",
  "smsBroadcast.selectRecipientType": "ዓይነት ተቐባሊ ምረጽ",
  "smsBroadcast.typeIndividual": "ውልቀሰብ",
  "smsBroadcast.typeDepartment": "ክፍሊ ስራሕ",
  "smsBroadcast.typePending": "ተጸበይቲ ቃላት",
  "smsBroadcast.typeFulfilled": "ዝተፈጸሙ ቃላት",
  "smsBroadcast.typeAll": "ኩሎም ኣባላት",
  "smsBroadcast.selectMember": "ኣባል ምረጽ",
  "smsBroadcast.searchMembersPlaceholder": "ኣባላት ብስም ወይ ስልኪ ድለ…",
  "smsBroadcast.loadingMembers": "ኣባላት ይጽዕን ኣሎ…",
  "smsBroadcast.selectMemberOption": "-- ኣባል ምረጽ --",
  "smsBroadcast.selectDepartment": "ክፍሊ ስራሕ ምረጽ",
  "smsBroadcast.loadingDepartments": "ክፍልታት ስራሕ ይጽዕን ኣሎ…",
  "smsBroadcast.selectDepartmentOption": "-- ክፍሊ ስራሕ ምረጽ --",
  "smsBroadcast.deptOptionMembers": "ኣባላት",
  "smsBroadcast.onlyActiveDepts": "ኣባላት ዘለዎም ንጡፋት ክፍልታት ስራሕ ጥራይ ተዘርዚሮም።",
  "smsBroadcast.departmentMembers": "ኣባላት ክፍሊ ስራሕ",
  "smsBroadcast.loading": "ይጽዕን ኣሎ...",
  "smsBroadcast.willReceiveSuffix": "ኣባላት ነዚ መልእኽቲ ክቕበሉ እዮም",
  "smsBroadcast.hide": "ሕባእ",
  "smsBroadcast.show": "ኣርኢ",
  "smsBroadcast.memberList": "ዝርዝር ኣባላት",
  "smsBroadcast.recipientList": "ዝርዝር ተቐበልቲ",
  "smsBroadcast.noDeptMembers": "ኣብዚ ክፍሊ ስራሕ ስልኪ ዘለዎም ንጡፋት ኣባላት ኣይተረኽቡን።",
  "smsBroadcast.pendingRecipients": "ተቐበልቲ ተጸበይቲ ቃላት",
  "smsBroadcast.fulfilledRecipients": "ተቐበልቲ ዝተፈጸሙ ቃላት",
  "smsBroadcast.pendingPledgesCount": "{count} ተጸበይቲ ቃላት (ጠቕላላ፦ ${total})",
  "smsBroadcast.fulfilledPledgesCount": "{count} ዝተፈጸሙ ቃላት (ጠቕላላ፦ ${total})",
  "smsBroadcast.noPendingPledges": "ተጸበይቲ ቃል ዘለዎም ኣባላት ኣይተረኽቡን።",
  "smsBroadcast.noFulfilledPledges": "ቃሎም ዝፈጸሙ ኣባላት ኣይተረኽቡን።",
  "smsBroadcast.messageLabel": "መልእኽቲ",
  "smsBroadcast.templateVarsTitle": "💡 ዝርከቡ ናይ ቅዲ ተለዋወጥቲ፦",
  "smsBroadcast.varFirstName": "ስም ቀዳማይ",
  "smsBroadcast.varLastName": "ስም ኣቦ",
  "smsBroadcast.varFullName": "ምሉእ ስም",
  "smsBroadcast.varAmount": "መጠን ቃል (ንጽል)",
  "smsBroadcast.varTotalAmount": "ጠቕላላ ኩሎም ቃላት",
  "smsBroadcast.varPledgeCount": "ቁጽሪ ቃላት",
  "smsBroadcast.varDueDate": "ናይ ምኽፋል ዕለት (ንጽል)",
  "smsBroadcast.personalizedNote": "ነፍሲ ወከፍ ኣባል ብዝተነጻጸለ መልእኽቲ ክቕበል እዩ!",
  "smsBroadcast.placeholderPending": "ኣብነት፦ ሰላም {firstName}፡ ብዛዕባ {amount} ተጸባዪ ቃልኩም መዘኻኸሪ። ክሳብ፦ {dueDate}። የቐንየለይ!",
  "smsBroadcast.placeholderFulfilled": "ኣብነት፦ የቐንየለይ {firstName} ናይ {amount} ቃልኩም ስለዝፈጸምኩም! እግዚኣብሔር ይባርኽኩም።",
  "smsBroadcast.placeholderDefault": "ናይ SMS መልእኽትኹም ጽሓፉ…",
  "smsBroadcast.tooLongBy": "መልእኽቲ ብ{count} ፊደላት ነዊሕ እዩ",
  "smsBroadcast.charsRemaining": "{count} ፊደላት ተሪፎም",
  "smsBroadcast.totalSmsChars": "ጠቕላላ SMS፦ {used} / {max} ፊደላት",
  "smsBroadcast.costPrefix": "ግምታዊ ወጻኢ፦",
  "smsBroadcast.segmentsWord": "ክፋላት",
  "smsBroadcast.recipientsWord": "ተቐበልቲ",
  "smsBroadcast.segsWord": "ክፋላት",
  "smsBroadcast.approxCost": "(ገምጋም ${cost})",
  "smsBroadcast.standardEncoding": "ስሩዕ ኢንኮዲንግ",
  "smsBroadcast.unicodeEncoding": "ዩኒኮድ ኢንኮዲንግ",
  "smsBroadcast.pricingBreakdown": "${base} መሰረት + ${carrier} ካሪየር / ክፋል",
  "smsBroadcast.includeFooter": "ኣውቶማቲክ ፉተር ኣካትት",
  "smsBroadcast.footerHelp": "ስሩዕ ናይ ተኣዛዝነት መልእኽቲ ንምውጋድ ኣይትሓርዩ። በጃኹም ንልኣኺ ባዕልኹም ከተለልዩ ኣረጋግጹ።",
  "smsBroadcast.sending": "ይስደድ ኣሎ…",
  "smsBroadcast.sendSms": "SMS ስደድ"
};

// Convenience export for provider lookup
export const dictionaries: Record<Lang, Dictionaries> = { en, ti };
