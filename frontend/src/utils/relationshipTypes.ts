// Define allowed relationship values
export const RELATIONSHIP_VALUES = [
  'Son',
  'Daughter', 
  'Spouse',
  'Parent',
  'Sibling',
  'Other'
] as const;

// TypeScript type for relationship
export type Relationship = typeof RELATIONSHIP_VALUES[number];

// Interface for dependent with proper relationship typing
export interface Dependent {
  id?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender: 'Male' | 'Female';
  relationship?: Relationship;
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
}

// Helper function to validate relationship
export const isValidRelationship = (value: string): value is Relationship => {
  return RELATIONSHIP_VALUES.includes(value as Relationship);
};

// Helper function to get display label for relationship
export const getRelationshipLabel = (relationship: Relationship): string => {
  return relationship;
};

// Helper function to get relationship options for dropdown
export const getRelationshipOptions = () => {
  return RELATIONSHIP_VALUES.map(value => ({
    value,
    label: getRelationshipLabel(value)
  }));
}; 