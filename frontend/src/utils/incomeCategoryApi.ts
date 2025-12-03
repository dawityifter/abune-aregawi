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
  // 1. Try direct mapping via payment_type_mapping field
  let category = categories.find(cat => cat.payment_type_mapping === paymentType);
  if (category) return category;

  // 2. Try fallback mappings for payment types that might be mapped to other keys
  const fallbackMappings: { [key: string]: string } = {
    'tithe': 'offering',        // tithe might be mapped to offering
    'vow': 'donation',          // vow might be mapped to donation
    'religious_item_sales': 'other' // sales might be mapped to other
  };

  const fallbackType = fallbackMappings[paymentType];
  if (fallbackType) {
    category = categories.find(cat => cat.payment_type_mapping === fallbackType);
    if (category) return category;
  }

  // 3. Try keyword matching in the category name (case-insensitive)
  // This is useful if payment_type_mapping is not set in the database
  const keywordMap: { [key: string]: string[] } = {
    'membership_due': ['membership', 'dues', 'member'],
    'tithe': ['tithe', 'asrat'],
    'donation': ['donation', 'general'],
    'building_fund': ['building', 'fund', 'construction'],
    'offering': ['offering', 'meba', 'collection'],
    'vow': ['vow', 'silet', 'pledge'],
    'religious_item_sales': ['sales', 'religious', 'store', 'shop']
  };

  const keywords = keywordMap[paymentType];
  if (keywords) {
    category = categories.find(cat => {
      const nameLower = cat.name.toLowerCase();
      return keywords.some(keyword => nameLower.includes(keyword));
    });
  }

  return category;
}
