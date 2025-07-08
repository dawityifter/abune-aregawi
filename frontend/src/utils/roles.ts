// Role-based access control utilities

export type UserRole = 'admin' | 'church_leadership' | 'treasurer' | 'secretary' | 'member' | 'guest';

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
    canAccessAdminPanel: false,
    canManageRoles: false,
    canViewSystemLogs: false,
    
    // Documentation
    canManageDocumentation: true,
    canViewLeadershipActivities: true,
    
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
    canAccessAdminPanel: false,
    canManageRoles: false,
    canViewSystemLogs: false,
    
    // Documentation
    canManageDocumentation: false,
    canViewLeadershipActivities: false,
    
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