// Role-based access control utilities

export type UserRole = 'admin' | 'church_leadership' | 'treasurer' | 'bookkeeper' | 'budget_committee' | 'auditor' | 'ar_team' | 'ap_team' | 'relationship' | 'secretary' | 'member' | 'guest';

export interface RolePermissions {
  // Profile Management
  canViewOwnProfile: boolean;
  canEditOwnProfile: boolean;
  canViewAllMembers: boolean;
  canEditAllMembers: boolean;
  canDeleteMembers: boolean;
  canRegisterMembers: boolean;

  // Financial Management
  canSubmitDonation: boolean;
  canViewFinancialRecords: boolean;
  canEditFinancialRecords: boolean; // Broad access, maintained for backward compatibility (Treasurer/Admin)
  canManageIncome: boolean; // Granular: AR Team, Bookkeeper
  canManageExpenses: boolean; // Granular: AP Team, Bookkeeper
  canApproveBudget: boolean; // Granular: Budget Committee
  canViewAuditLogs: boolean; // Granular: Auditor
  canGenerateFinancialReports: boolean;
  canTrackContributions: boolean;
  canManagePledges: boolean;
  canViewPledgeReports: boolean;

  // Expense Management
  canViewExpenses: boolean;
  canAddExpenses: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;

  // Event & Communication
  canManageEvents: boolean;
  canSendCommunications: boolean;
  canViewEventPlanning: boolean;

  // System Administration
  canAccessAdminPanel: boolean;
  canManageRoles: boolean;
  canViewSystemLogs: boolean;

  // Documentation
  canManageDocumentation: boolean;
  canViewLeadershipActivities: boolean;

  // Outreach & Relations
  canAccessOnboardingNotifications: boolean; // Access new member registration notifications
  canManageOnboarding: boolean; // Contact/manage onboarding, mark welcomed
  canAccessOutreachDashboard: boolean; // View new members, follow-up tasks
  canRecordEngagement: boolean; // Record/track member engagement activities
  canManageExternalPartners: boolean; // Add/edit partner org info
  canGenerateOutreachReports: boolean; // Generate outreach/relationship reports

  // Public Access
  canViewPublicInfo: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true,
    canEditAllMembers: true,
    canDeleteMembers: true,
    canRegisterMembers: true,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: true,
    canManageIncome: true,
    canManageExpenses: true,
    canApproveBudget: true,
    canViewAuditLogs: true,
    canGenerateFinancialReports: true,
    canTrackContributions: true,
    canManagePledges: true,
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,

    // Event & Communication
    canManageEvents: true,
    canSendCommunications: true,
    canViewEventPlanning: true,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: true,
    canViewSystemLogs: true,

    // Documentation
    canManageDocumentation: true,
    canViewLeadershipActivities: true,

    // Outreach & Relations
    canAccessOnboardingNotifications: true,
    canManageOnboarding: true,
    canAccessOutreachDashboard: true,
    canRecordEngagement: true,
    canManageExternalPartners: true,
    canGenerateOutreachReports: true,

    // Public Access
    canViewPublicInfo: true,
  },
  treasurer: { // Maintains SUPER USER status for finances
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: true,
    canManageIncome: true,
    canManageExpenses: true,
    canApproveBudget: true,
    canViewAuditLogs: true,
    canGenerateFinancialReports: true,
    canTrackContributions: true,
    canManagePledges: true,
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  bookkeeper: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true, // Needs to verify member payments
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: true, // Needed for general ledger management
    canManageIncome: true,
    canManageExpenses: true,
    canApproveBudget: false, // Cannot approve off-budget items
    canViewAuditLogs: false,
    canGenerateFinancialReports: true,
    canTrackContributions: true,
    canManagePledges: true,
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true, // Needs access to finance modules
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  budget_committee: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: false,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: true, // Specific power
    canViewAuditLogs: false,
    canGenerateFinancialReports: true,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  auditor: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false, // Read-only
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: true, // Key permission
    canGenerateFinancialReports: true,
    canTrackContributions: true, // Read-only view
    canManagePledges: false, // Read-only view
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: true, // To audit system actions

    // Documentation
    canManageDocumentation: true, // Can add audit reports
    canViewLeadershipActivities: true,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: true,

    // Public Access
    canViewPublicInfo: true,
  },
  ar_team: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true, // Needs to verify member payments
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canManageIncome: true, // Focus
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: true,
    canManagePledges: true, // Manage invoices/pledges
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: false, // Focused on income
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: true, // Send invoices/receipts
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  ap_team: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: false,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: true, // Focus
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: false,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: true, // Vendor management
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  church_leadership: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true,
    canEditAllMembers: true,
    canDeleteMembers: false,
    canRegisterMembers: true,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: true, // Leadership approves budget
    canViewAuditLogs: false,
    canGenerateFinancialReports: true,
    canTrackContributions: false,
    canManagePledges: true,
    canViewPledgeReports: true,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: true,
    canSendCommunications: true,
    canViewEventPlanning: true,

    // System Administration
    canAccessAdminPanel: true,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: true,
    canViewLeadershipActivities: true,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  secretary: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true,
    canEditAllMembers: true,
    canDeleteMembers: false,
    canRegisterMembers: true,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: false,

    // Expense Management
    canViewExpenses: true,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: true,
    canSendCommunications: true,
    canViewEventPlanning: true,

    // System Administration
    canAccessAdminPanel: false,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: true,
    canViewLeadershipActivities: true,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  relationship: {
    // Profile Management (inherits Member base)
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: true, // Needs to view new members
    canEditAllMembers: true, //For a timebeing allow. Restricted: cannot modify treasury/secretary records; keep off for safety
    canDeleteMembers: false, // Restricted
    canRegisterMembers: true, // Not responsible for registration itself

    // Financial Management (restricted)
    canSubmitDonation: true, // same as Member
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: false,

    // Expense Management
    canViewExpenses: false,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: false, // Access via broadened member-management gate where applicable
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: true,
    canManageOnboarding: true,
    canAccessOutreachDashboard: true,
    canRecordEngagement: true,
    canManageExternalPartners: true,
    canGenerateOutreachReports: true,

    // Public Access
    canViewPublicInfo: true,
  },
  member: {
    // Profile Management
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canViewAllMembers: false,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: true,
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: false,

    // Expense Management
    canViewExpenses: false,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: false,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
  guest: {
    // Profile Management
    canViewOwnProfile: false,
    canEditOwnProfile: false,
    canViewAllMembers: false,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canRegisterMembers: false,

    // Financial Management
    canSubmitDonation: false,
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canManageIncome: false,
    canManageExpenses: false,
    canApproveBudget: false,
    canViewAuditLogs: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    canManagePledges: false,
    canViewPledgeReports: false,

    // Expense Management
    canViewExpenses: false,
    canAddExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,

    // Event & Communication
    canManageEvents: false,
    canSendCommunications: false,
    canViewEventPlanning: false,

    // System Administration
    canAccessAdminPanel: false,
    canManageRoles: false,
    canViewSystemLogs: false,

    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,

    // Outreach & Relations
    canAccessOnboardingNotifications: false,
    canManageOnboarding: false,
    canAccessOutreachDashboard: false,
    canRecordEngagement: false,
    canManageExternalPartners: false,
    canGenerateOutreachReports: false,

    // Public Access
    canViewPublicInfo: true,
  },
};

export const getRolePermissions = (role: UserRole): RolePermissions => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.guest;
};

/**
 * Merges permissions from multiple roles.
 * A permission is granted if ANY of the roles grant it.
 */
export const getMergedPermissions = (roles: UserRole[]): RolePermissions => {
  // Start with guest permissions as base
  const merged = { ...ROLE_PERMISSIONS.guest };

  roles.forEach(role => {
    const permissions = getRolePermissions(role);
    (Object.keys(permissions) as Array<keyof RolePermissions>).forEach(key => {
      if (permissions[key] === true) {
        (merged[key] as boolean) = true;
      }
    });
  });

  return merged;
};

export const hasPermission = (
  userRoles: UserRole | UserRole[],
  permission: keyof RolePermissions
): boolean => {
  const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
  return roles.some(role => {
    const permissions = getRolePermissions(role);
    return permissions[permission] === true;
  });
};

export const canAccessRoute = (userRoles: UserRole | UserRole[], requiredPermissions: (keyof RolePermissions)[]): boolean => {
  return requiredPermissions.every(permission => hasPermission(userRoles, permission));
};

export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    admin: 'Admin/Super Admin',
    church_leadership: 'Church Leadership',
    treasurer: 'Treasurer',
    bookkeeper: 'Bookkeeper',
    budget_committee: 'Budget Committee',
    auditor: 'Auditor/Reviewer',
    ar_team: 'AR Team (Income)',
    ap_team: 'AP Team (Expenses)',
    relationship: '🤝 Relationship Department',
    secretary: 'Secretary',
    member: 'Member',
    guest: 'Guest',
  };
  return displayNames[role] || 'Guest';
};

export const getRoleDescription = (role: UserRole): string => {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full system access - can manage all aspects of the church management system',
    church_leadership: 'Access to member management, financial reports, event planning, and leadership activities',
    treasurer: 'Super Finance User: Oversees all financial activities, approves disbursements, presents reports',
    bookkeeper: 'Records payments/expenses, reconciles accounts, maintains trackers (Operational Finance)',
    budget_committee: 'Sets budgets, reviews spending, recommends adjustments (Planning & Oversight)',
    auditor: 'Read-only access to verify transactions and ensure policy compliance (Compliance)',
    ar_team: 'Generates invoices, sends receipts, runs aging reports (Income Focused)',
    ap_team: 'Records expenses, manages vendor invoices, issues payments (Expense Focused)',
    relationship: 'Welcomes new members, facilitates integration into the community, and maintains relationships with external relief and community organizations.',
    secretary: 'Member registration, documentation, and communication management',
    member: 'Basic access to own profile and limited features like donation submission',
    guest: 'Public access to general information only',
  };
  return descriptions[role] || 'Public access to general information only';
};

// Helper functions for common permission checks
export const canManageMembers = (role: UserRole | UserRole[]): boolean => {
  return hasPermission(role, 'canViewAllMembers') && hasPermission(role, 'canEditAllMembers');
};

export const canManageFinances = (role: UserRole | UserRole[]): boolean => {
  return hasPermission(role, 'canViewFinancialRecords') && hasPermission(role, 'canEditFinancialRecords');
};

export const canViewFinances = (role: UserRole | UserRole[]): boolean => {
  return hasPermission(role, 'canViewFinancialRecords');
};

export const canManageEvents = (role: UserRole | UserRole[]): boolean => {
  return hasPermission(role, 'canManageEvents');
};

export const canManageDocumentation = (role: UserRole | UserRole[]): boolean => {
  return hasPermission(role, 'canManageDocumentation');
}; 