import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentDateCST } from '../../utils/dateUtils';

interface ExpenseCategory {
  id: string;
  gl_code: string;
  name: string;
  description: string;
  is_active: boolean;
  is_fixed: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position?: string;
  is_active: boolean;
}

interface Vendor {
  id: string;
  name: string;
  vendor_type: string;
  is_active: boolean;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { firebaseUser } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Form state
  const [glCode, setGlCode] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(getCurrentDateCST());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check'>('check');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [memo, setMemo] = useState('');

  // Payee fields
  const [employeeId, setEmployeeId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [payeeName, setPayeeName] = useState('');

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Fetch expense categories, employees, and vendors
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchEmployees();
      fetchVendors();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/expenses/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      } else {
        setError('Failed to load expense categories');
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load expense categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/employees?is_active=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      // Don't show error - employees are optional
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchVendors = async () => {
    try {
      setLoadingVendors(true);
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/vendors?is_active=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVendors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      // Don't show error - vendors are optional
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setAmountError(null);
    }
  };

  const validateForm = (): boolean => {
    // Validate GL code
    if (!glCode) {
      setError('Please select an expense category');
      return false;
    }

    // Validate amount
    const amountValue = parseFloat(amount);
    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      setAmountError('Please enter a valid amount greater than $0.00');
      return false;
    }

    // Validate date
    if (!expenseDate) {
      setError('Please select an expense date');
      return false;
    }

    // Validate date is not in future (in CST timezone)
    const selectedDate = new Date(expenseDate + 'T00:00:00');
    const now = new Date();
    const todayCST = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    todayCST.setHours(23, 59, 59, 999);
    if (selectedDate > todayCST) {
      setError('Expense date cannot be in the future');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAmountError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();

      const requestBody: any = {
        gl_code: glCode,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod,
        receipt_number: receiptNumber || null,
        memo: memo || null
      };

      // Add payee information (only one should be set)
      if (employeeId) {
        requestBody.employee_id = employeeId;
      } else if (vendorId) {
        requestBody.vendor_id = vendorId;
      } else if (payeeName) {
        requestBody.payee_name = payeeName;
      }

      // Add check number if payment method is check
      if (paymentMethod === 'check' && checkNumber) {
        requestBody.check_number = checkNumber;
      }

      // Add invoice number if provided
      if (invoiceNumber) {
        requestBody.invoice_number = invoiceNumber;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form
        setGlCode('');
        setAmount('');
        setExpenseDate(getCurrentDateCST());
        setPaymentMethod('check');
        setReceiptNumber('');
        setCheckNumber('');
        setInvoiceNumber('');
        setMemo('');
        setEmployeeId('');
        setVendorId('');
        setPayeeName('');

        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Failed to record expense');
      }
    } catch (err) {
      console.error('Error recording expense:', err);
      setError('An error occurred while recording the expense');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setAmountError(null);
      // Reset form
      setGlCode('');
      setAmount('');
      setExpenseDate(getCurrentDateCST());
      setPaymentMethod('check');
      setReceiptNumber('');
      setCheckNumber('');
      setInvoiceNumber('');
      setMemo('');
      setEmployeeId('');
      setVendorId('');
      setPayeeName('');
      onClose();
    }
  };

  // Determine which payee fields to show based on expense category
  const shouldShowEmployeeField = () => {
    // Salary/Allowance expenses typically use EXP001 or similar
    // You can customize this logic based on your GL codes
    return glCode && (glCode.includes('6000') || glCode.includes('EXP001') ||
      selectedCategory?.name?.toLowerCase().includes('salary') ||
      selectedCategory?.name?.toLowerCase().includes('allowance'));
  };

  const shouldShowVendorField = () => {
    // Vendor expenses for utilities, services, etc.
    return glCode && !shouldShowEmployeeField() && (
      glCode.includes('6100') || glCode.includes('EXP005') ||
      selectedCategory?.name?.toLowerCase().includes('utility') ||
      selectedCategory?.name?.toLowerCase().includes('service') ||
      selectedCategory?.name?.toLowerCase().includes('supplier')
    );
  };

  const shouldShowPayeeNameField = () => {
    // Generic payee for other expenses
    return glCode && !shouldShowEmployeeField() && !shouldShowVendorField();
  };

  // Reset payee fields when category changes
  const handleGlCodeChange = (value: string) => {
    setGlCode(value);
    // Clear payee fields when category changes
    setEmployeeId('');
    setVendorId('');
    setPayeeName('');
  };

  if (!isOpen) return null;

  const selectedCategory = categories.find(c => c.gl_code === glCode);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-2xl font-bold">Record Expense</h2>
          <p className="text-blue-100 text-sm mt-1">Add a new expense transaction</p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Expense Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Category <span className="text-red-500">*</span>
            </label>
            {loadingCategories ? (
              <div className="text-gray-500">Loading categories...</div>
            ) : (
              <select
                value={glCode}
                onChange={(e) => handleGlCodeChange(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Category --</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.gl_code}>
                    {category.gl_code} - {category.name}
                  </option>
                ))}
              </select>
            )}
            {selectedCategory?.description && (
              <p className="mt-1 text-xs text-gray-500">{selectedCategory.description}</p>
            )}
          </div>

          {/* Payee Section - Employee (for salary/allowance expenses) */}
          {shouldShowEmployeeField() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee <span className="text-red-500">*</span>
              </label>
              {loadingEmployees ? (
                <div className="text-gray-500 text-sm">Loading employees...</div>
              ) : (
                <select
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                    setVendorId('');
                    setPayeeName('');
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                      {employee.position ? ` - ${employee.position}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {employees.length === 0 && !loadingEmployees && (
                <p className="mt-1 text-xs text-gray-500">
                  No active employees found. Add employees in the Employee Management section.
                </p>
              )}
            </div>
          )}

          {/* Payee Section - Vendor (for vendor payments) */}
          {shouldShowVendorField() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor <span className="text-red-500">*</span>
              </label>
              {loadingVendors ? (
                <div className="text-gray-500 text-sm">Loading vendors...</div>
              ) : (
                <select
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    setEmployeeId('');
                    setPayeeName('');
                  }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.vendor_type})
                    </option>
                  ))}
                </select>
              )}
              {vendors.length === 0 && !loadingVendors && (
                <p className="mt-1 text-xs text-gray-500">
                  No active vendors found. Add vendors in the Vendor Management section.
                </p>
              )}
            </div>
          )}

          {/* Payee Section - Generic Payee Name (for other expenses) */}
          {shouldShowPayeeNameField() && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payee Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => {
                  setPayeeName(e.target.value);
                  setEmployeeId('');
                  setVendorId('');
                }}
                placeholder="Enter payee name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the name of the person or organization being paid
              </p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {amountError && (
              <p className="mt-1 text-xs text-red-600">{amountError}</p>
            )}
          </div>

          {/* Expense Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col space-y-2">
              <div className="flex space-x-4">
                <label className="flex items-center text-gray-400 cursor-not-allowed" title="Paying in cash is discouraged">
                  <input
                    type="radio"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'check')}
                    className="mr-2"
                    disabled
                  />
                  Cash
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="check"
                    checked={paymentMethod === 'check'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'check')}
                    className="mr-2"
                  />
                  Check
                </label>
              </div>
              <p className="text-xs text-amber-600 italic">
                Note: Paying in cash is discouraged. Please use Check whenever possible.
              </p>
            </div>
          </div>

          {/* Check Number (only for check payments) */}
          {paymentMethod === 'check' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check Number
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="CHK-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Receipt Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt Number
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="REC-1234"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>



          {/* Invoice Number (optional, shown for vendor payments or when vendor is selected) */}
          {(shouldShowVendorField() || vendorId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Invoice or bill number from vendor
              </p>
            </div>
          )}

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Memo/Description
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Additional notes about this expense..."
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">{memo.length}/500 characters</p>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingCategories}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpenseModal;
