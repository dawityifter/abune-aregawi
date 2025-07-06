// MemberData interface definition (standalone for deployment)
export interface MemberData {
  id: number;
  name: string;
  phone: string;
  year: string;
  paymentMethod: string;
  monthlyPayment: number;
  totalAmountDue: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  totalCollected: number;
  balanceDue: number;
  paidUpTo: string;
  householdCount: number;
}

// Mock member data for deployment - contains only sample data
export const mockMembersData: MemberData[] = [
  {
    id: 1,
    name: "Sample Member 1",
    phone: "555-0001",
    year: "2024",
    paymentMethod: "Check",
    monthlyPayment: 50,
    totalAmountDue: 600,
    jan: 50, feb: 50, mar: 50, apr: 50, may: 50, jun: 50,
    jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50,
    totalCollected: 600,
    balanceDue: 0,
    paidUpTo: "12/01/24",
    householdCount: 2
  },
  {
    id: 2,
    name: "Sample Member 2",
    phone: "555-0002",
    year: "2024",
    paymentMethod: "PayPal",
    monthlyPayment: 25,
    totalAmountDue: 300,
    jan: 25, feb: 25, mar: 25, apr: 25, may: 25, jun: 25,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
    totalCollected: 150,
    balanceDue: 150,
    paidUpTo: "06/01/24",
    householdCount: 1
  },
  {
    id: 3,
    name: "Sample Member 3",
    phone: "555-0003",
    year: "2024",
    paymentMethod: "Cash",
    monthlyPayment: 100,
    totalAmountDue: 1200,
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
    totalCollected: 0,
    balanceDue: 1200,
    paidUpTo: "",
    householdCount: 0
  },
  {
    id: 4,
    name: "Sample Member 4",
    phone: "555-0004",
    year: "2024",
    paymentMethod: "Check",
    monthlyPayment: 75,
    totalAmountDue: 900,
    jan: 75, feb: 75, mar: 75, apr: 75, may: 75, jun: 75,
    jul: 75, aug: 75, sep: 75, oct: 0, nov: 0, dec: 0,
    totalCollected: 675,
    balanceDue: 225,
    paidUpTo: "09/01/24",
    householdCount: 3
  },
  {
    id: 5,
    name: "Sample Member 5",
    phone: "555-0005",
    year: "2024",
    paymentMethod: "PayPal",
    monthlyPayment: 30,
    totalAmountDue: 360,
    jan: 30, feb: 30, mar: 30, apr: 30, may: 30, jun: 30,
    jul: 30, aug: 30, sep: 30, oct: 30, nov: 30, dec: 30,
    totalCollected: 360,
    balanceDue: 0,
    paidUpTo: "12/01/24",
    householdCount: 1
  }
];

// Export the same interface for compatibility
export const allMembersData: MemberData[] = mockMembersData; 