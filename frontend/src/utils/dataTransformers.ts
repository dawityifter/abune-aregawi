// Data transformers for consistent field mapping between frontend and backend
// Frontend uses camelCase, Backend uses snake_case

// ============================================================================
// MEMBER TRANSFORMERS
// ============================================================================

export interface BackendMember {
  id: number;
  firebase_uid?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  phone_number: string;
  date_of_birth?: string;
  gender?: string;
  baptism_name?: string;
  repentance_father?: string;
  household_size?: number;
  street_line1?: string;
  apartment_no?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  date_joined_parish?: string;
  spouse_name?: string;
  family_id?: number;
  role: string;
  is_active: boolean;
  registration_status?: string;
  created_at: string;
  updated_at: string;
}

export interface FrontendMember {
  id: number;
  firebaseUid?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phoneNumber: string;
  dateOfBirth?: string;
  gender?: string;
  baptismName?: string;
  repentanceFather?: string;
  householdSize?: number;
  streetLine1?: string;
  apartmentNo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateJoinedParish?: string;
  spouseName?: string;
  familyId?: number;
  role: string;
  isActive: boolean;
  registrationStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export const transformMemberFromBackend = (backendMember: BackendMember): FrontendMember => ({
  id: backendMember.id,
  firebaseUid: backendMember.firebase_uid,
  firstName: backendMember.first_name,
  middleName: backendMember.middle_name,
  lastName: backendMember.last_name,
  email: backendMember.email,
  phoneNumber: backendMember.phone_number,
  dateOfBirth: backendMember.date_of_birth,
  gender: backendMember.gender,
  baptismName: backendMember.baptism_name,
  repentanceFather: backendMember.repentance_father,
  householdSize: backendMember.household_size,
  streetLine1: backendMember.street_line1,
  apartmentNo: backendMember.apartment_no,
  city: backendMember.city,
  state: backendMember.state,
  postalCode: backendMember.postal_code,
  country: backendMember.country,
  emergencyContactName: backendMember.emergency_contact_name,
  emergencyContactPhone: backendMember.emergency_contact_phone,
  dateJoinedParish: backendMember.date_joined_parish,
  spouseName: backendMember.spouse_name,
  familyId: backendMember.family_id,
  role: backendMember.role,
  isActive: backendMember.is_active,
  registrationStatus: backendMember.registration_status,
  createdAt: backendMember.created_at,
  updatedAt: backendMember.updated_at,
});

export const transformMemberToBackend = (frontendMember: FrontendMember): BackendMember => ({
  id: frontendMember.id,
  firebase_uid: frontendMember.firebaseUid,
  first_name: frontendMember.firstName,
  middle_name: frontendMember.middleName,
  last_name: frontendMember.lastName,
  email: frontendMember.email,
  phone_number: frontendMember.phoneNumber,
  date_of_birth: frontendMember.dateOfBirth,
  gender: frontendMember.gender,
  baptism_name: frontendMember.baptismName,
  repentance_father: frontendMember.repentanceFather,
  household_size: frontendMember.householdSize,
  street_line1: frontendMember.streetLine1,
  apartment_no: frontendMember.apartmentNo,
  city: frontendMember.city,
  state: frontendMember.state,
  postal_code: frontendMember.postalCode,
  country: frontendMember.country,
  emergency_contact_name: frontendMember.emergencyContactName,
  emergency_contact_phone: frontendMember.emergencyContactPhone,
  date_joined_parish: frontendMember.dateJoinedParish,
  spouse_name: frontendMember.spouseName,
  family_id: frontendMember.familyId,
  role: frontendMember.role,
  is_active: frontendMember.isActive,
  registration_status: frontendMember.registrationStatus,
  created_at: frontendMember.createdAt,
  updated_at: frontendMember.updatedAt,
});

// ============================================================================
// DEPENDENT TRANSFORMERS
// ============================================================================

export interface BackendDependent {
  id?: number;
  memberId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FrontendDependent {
  id?: number;
  memberId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const transformDependentFromBackend = (backendDependent: BackendDependent): FrontendDependent => ({
  id: backendDependent.id,
  memberId: backendDependent.memberId,
  firstName: backendDependent.firstName,
  middleName: backendDependent.middleName,
  lastName: backendDependent.lastName,
  dateOfBirth: backendDependent.dateOfBirth,
  gender: backendDependent.gender,
  relationship: backendDependent.relationship,
  phone: backendDependent.phone,
  email: backendDependent.email,
  baptismName: backendDependent.baptismName,
  isBaptized: backendDependent.isBaptized,
  baptismDate: backendDependent.baptismDate,
  nameDay: backendDependent.nameDay,
  medicalConditions: backendDependent.medicalConditions,
  allergies: backendDependent.allergies,
  medications: backendDependent.medications,
  dietaryRestrictions: backendDependent.dietaryRestrictions,
  notes: backendDependent.notes,
  createdAt: backendDependent.createdAt,
  updatedAt: backendDependent.updatedAt,
});

export const transformDependentToBackend = (frontendDependent: FrontendDependent): BackendDependent => ({
  id: frontendDependent.id,
  memberId: frontendDependent.memberId,
  firstName: frontendDependent.firstName,
  middleName: frontendDependent.middleName,
  lastName: frontendDependent.lastName,
  dateOfBirth: frontendDependent.dateOfBirth,
  gender: frontendDependent.gender,
  relationship: frontendDependent.relationship,
  phone: frontendDependent.phone,
  email: frontendDependent.email,
  baptismName: frontendDependent.baptismName,
  isBaptized: frontendDependent.isBaptized,
  baptismDate: frontendDependent.baptismDate,
  nameDay: frontendDependent.nameDay,
  medicalConditions: frontendDependent.medicalConditions,
  allergies: frontendDependent.allergies,
  medications: frontendDependent.medications,
  dietaryRestrictions: frontendDependent.dietaryRestrictions,
  notes: frontendDependent.notes,
  createdAt: frontendDependent.createdAt,
  updatedAt: frontendDependent.updatedAt,
});

// ============================================================================
// TRANSACTION TRANSFORMERS
// ============================================================================

export interface BackendTransaction {
  id: number;
  member_id: number;
  collected_by: number;
  payment_date: string;
  amount: number;
  payment_type: string;
  payment_method: string;
  receipt_number?: string;
  note?: string;
  created_at: string;
  updated_at: string;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  collector?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
}

export interface FrontendTransaction {
  id: number;
  memberId: number;
  collectedBy: number;
  paymentDate: string;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  receiptNumber?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  collector?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
}

export const transformTransactionFromBackend = (backendTransaction: BackendTransaction): FrontendTransaction => ({
  id: backendTransaction.id,
  memberId: backendTransaction.member_id,
  collectedBy: backendTransaction.collected_by,
  paymentDate: backendTransaction.payment_date,
  amount: backendTransaction.amount,
  paymentType: backendTransaction.payment_type,
  paymentMethod: backendTransaction.payment_method,
  receiptNumber: backendTransaction.receipt_number,
  note: backendTransaction.note,
  createdAt: backendTransaction.created_at,
  updatedAt: backendTransaction.updated_at,
  member: backendTransaction.member ? {
    id: backendTransaction.member.id,
    firstName: backendTransaction.member.first_name,
    lastName: backendTransaction.member.last_name,
    email: backendTransaction.member.email,
    phoneNumber: backendTransaction.member.phone_number,
  } : undefined,
  collector: backendTransaction.collector ? {
    id: backendTransaction.collector.id,
    firstName: backendTransaction.collector.first_name,
    lastName: backendTransaction.collector.last_name,
    email: backendTransaction.collector.email,
    phoneNumber: backendTransaction.collector.phone_number,
  } : undefined,
});

export const transformTransactionToBackend = (frontendTransaction: FrontendTransaction): BackendTransaction => ({
  id: frontendTransaction.id,
  member_id: frontendTransaction.memberId,
  collected_by: frontendTransaction.collectedBy,
  payment_date: frontendTransaction.paymentDate,
  amount: frontendTransaction.amount,
  payment_type: frontendTransaction.paymentType,
  payment_method: frontendTransaction.paymentMethod,
  receipt_number: frontendTransaction.receiptNumber,
  note: frontendTransaction.note,
  created_at: frontendTransaction.createdAt,
  updated_at: frontendTransaction.updatedAt,
  member: frontendTransaction.member ? {
    id: frontendTransaction.member.id,
    first_name: frontendTransaction.member.firstName,
    last_name: frontendTransaction.member.lastName,
    email: frontendTransaction.member.email,
    phone_number: frontendTransaction.member.phoneNumber,
  } : undefined,
  collector: frontendTransaction.collector ? {
    id: frontendTransaction.collector.id,
    first_name: frontendTransaction.collector.firstName,
    last_name: frontendTransaction.collector.lastName,
    email: frontendTransaction.collector.email,
    phone_number: frontendTransaction.collector.phoneNumber,
  } : undefined,
});

// ============================================================================
// ARRAY TRANSFORMERS
// ============================================================================

export const transformMembersFromBackend = (backendMembers: BackendMember[]): FrontendMember[] => 
  backendMembers.map(transformMemberFromBackend);

export const transformMembersToBackend = (frontendMembers: FrontendMember[]): BackendMember[] => 
  frontendMembers.map(transformMemberToBackend);

export const transformDependentsFromBackend = (backendDependents: BackendDependent[]): FrontendDependent[] => 
  backendDependents.map(transformDependentFromBackend);

export const transformDependentsToBackend = (frontendDependents: FrontendDependent[]): BackendDependent[] => 
  frontendDependents.map(transformDependentToBackend);

export const transformTransactionsFromBackend = (backendTransactions: BackendTransaction[]): FrontendTransaction[] => 
  backendTransactions.map(transformTransactionFromBackend);

export const transformTransactionsToBackend = (frontendTransactions: FrontendTransaction[]): BackendTransaction[] => 
  frontendTransactions.map(transformTransactionToBackend);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const isBackendMember = (obj: any): obj is BackendMember => {
  return obj && typeof obj === 'object' && 'first_name' in obj;
};

export const isFrontendMember = (obj: any): obj is FrontendMember => {
  return obj && typeof obj === 'object' && 'firstName' in obj;
};

export const isBackendTransaction = (obj: any): obj is BackendTransaction => {
  return obj && typeof obj === 'object' && 'member_id' in obj;
};

export const isFrontendTransaction = (obj: any): obj is FrontendTransaction => {
  return obj && typeof obj === 'object' && 'memberId' in obj;
};

export const isBackendDependent = (obj: any): obj is BackendDependent => {
  return obj && typeof obj === 'object' && 'firstName' in obj && 'memberId' in obj;
};

export const isFrontendDependent = (obj: any): obj is FrontendDependent => {
  return obj && typeof obj === 'object' && 'firstName' in obj && 'memberId' in obj;
}; 