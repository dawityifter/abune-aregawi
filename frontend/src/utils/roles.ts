// Role-based access control utilities

export type UserRole = 'admin' | 'church_leadership' | 'treasurer' | 'relationship' | 'secretary' | 'member' | 'guest';

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
  canEditFinancialRecords: boolean;
  canGenerateFinancialReports: boolean;
  canTrackContributions: boolean;
  
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
    canGenerateFinancialReports: true,
    canTrackContributions: true,
    
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
    canGenerateFinancialReports: true,
    canTrackContributions: false,
    
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
  treasurer: {
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
    canGenerateFinancialReports: true,
    canTrackContributions: true,
    
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
    canGenerateFinancialReports: false,
    canTrackContributions: false,

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
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    
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
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    
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
    canGenerateFinancialReports: false,
    canTrackContributions: false,
    
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

export const hasPermission = (
  userRole: UserRole,
  permission: keyof RolePermissions
): boolean => {
  const permissions = getRolePermissions(userRole);
  return permissions[permission] || false;
};

export const canAccessRoute = (userRole: UserRole, requiredPermissions: (keyof RolePermissions)[]): boolean => {
  return requiredPermissions.every(permission => hasPermission(userRole, permission));
};

export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    admin: 'Admin/Super Admin',
    church_leadership: 'Church Leadership',
    treasurer: 'Treasurer',
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
    treasurer: 'Financial management, contribution tracking, and reporting capabilities',
    relationship: 'Welcomes new members, facilitates integration into the community, and maintains relationships with external relief and community organizations. Can access onboarding notifications, manage onboarding, view outreach dashboard, record engagement, manage partner orgs, and generate outreach reports (no finance or system admin access).',
    secretary: 'Member registration, documentation, and communication management',
    member: 'Basic access to own profile and limited features like donation submission',
    guest: 'Public access to general information only',
  };
  return descriptions[role] || 'Public access to general information only';
};

// Helper functions for common permission checks
export const canManageMembers = (role: UserRole): boolean => {
  return hasPermission(role, 'canViewAllMembers') && hasPermission(role, 'canEditAllMembers');
};

export const canManageFinances = (role: UserRole): boolean => {
  return hasPermission(role, 'canViewFinancialRecords') && hasPermission(role, 'canEditFinancialRecords');
};

export const canViewFinances = (role: UserRole): boolean => {
  return hasPermission(role, 'canViewFinancialRecords');
};

export const canManageEvents = (role: UserRole): boolean => {
  return hasPermission(role, 'canManageEvents');
};

export const canManageDocumentation = (role: UserRole): boolean => {
  return hasPermission(role, 'canManageDocumentation');
}; 