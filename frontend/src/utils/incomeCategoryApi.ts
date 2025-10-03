import { auth } from '../firebase';

export interface IncomeCategory {
  id: number;
  gl_code: string;
  name: string;
  description: string;
  payment_type_mapping: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all active income categories
 */
export async function fetchIncomeCategories(activeOnly: boolean = true): Promise<IncomeCategory[]> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    const params = new URLSearchParams();
    if (activeOnly) {
      params.set('active_only', 'true');
    }

    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/income-categories?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch income categories');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching income categories:', error);
    throw error;
  }
}

/**
 * Get income category by ID
 */
export async function getIncomeCategoryById(id: number): Promise<IncomeCategory | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/income-categories/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching income category:', error);
    return null;
  }
}

/**
 * Get income category by payment type mapping
 * Includes fallback mappings for payment types without direct mapping
 */
export function getIncomeCategoryByPaymentType(
  categories: IncomeCategory[],
  paymentType: string
): IncomeCategory | undefined {
  // First try direct mapping
  let category = categories.find(cat => cat.payment_type_mapping === paymentType);
  
  // Fallback mappings for payment types without direct mapping
  if (!category) {
    const fallbackMappings: { [key: string]: string } = {
      'tithe': 'offering',        // tithe → INC002 (Weekly Offering)
      'building_fund': 'event'    // building_fund → INC003 (Fundraising)
    };
    
    const fallbackType = fallbackMappings[paymentType];
    if (fallbackType) {
      category = categories.find(cat => cat.payment_type_mapping === fallbackType);
    }
  }
  
  return category;
}
