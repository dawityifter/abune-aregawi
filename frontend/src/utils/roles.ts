// Role-based access control utilities

export type UserRole = 'member' | 'accountant' | 'auditor' | 'clergy';

export interface RolePermissions {
  canViewOwnProfile: boolean;
  canEditOwnProfile: boolean;
  canSubmitDonation: boolean;
  canViewFinancialRecords: boolean;
  canEditFinancialRecords: boolean;
  canViewAllMembers: boolean;
  canEditAllMembers: boolean;
  canDeleteMembers: boolean;
  canViewSpiritualRecords: boolean;
  canEditSpiritualRecords: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  member: {
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canSubmitDonation: true,
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canViewAllMembers: false,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canViewSpiritualRecords: false,
    canEditSpiritualRecords: false,
  },
  accountant: {
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: true,
    canViewAllMembers: true,
    canEditAllMembers: true,
    canDeleteMembers: true,
    canViewSpiritualRecords: false,
    canEditSpiritualRecords: false,
  },
  auditor: {
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canSubmitDonation: true,
    canViewFinancialRecords: true,
    canEditFinancialRecords: false,
    canViewAllMembers: true,
    canEditAllMembers: false,
    canDeleteMembers: false,
    canViewSpiritualRecords: false,
    canEditSpiritualRecords: false,
  },
  clergy: {
    canViewOwnProfile: true,
    canEditOwnProfile: true,
    canSubmitDonation: true,
    canViewFinancialRecords: false,
    canEditFinancialRecords: false,
    canViewAllMembers: true,
    canEditAllMembers: true,
    canDeleteMembers: false,
    canViewSpiritualRecords: true,
    canEditSpiritualRecords: true,
  },
};

export const getRolePermissions = (role: UserRole): RolePermissions => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.member;
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
    member: 'Member',
    accountant: 'Accountant',
    auditor: 'Auditor',
    clergy: 'Clergy',
  };
  return displayNames[role] || 'Member';
};

export const getRoleDescription = (role: UserRole): string => {
  const descriptions: Record<UserRole, string> = {
    member: 'Can view and edit own profile, submit donation',
    accountant: 'Can view and edit own profile, submit donation, edit financial records, view all financial records',
    auditor: 'Can view and edit own profile, submit donation, view all financial reports',
    clergy: 'Can view and edit own profile, submit donation, view spiritual records',
  };
  return descriptions[role] || 'Basic member access';
}; 