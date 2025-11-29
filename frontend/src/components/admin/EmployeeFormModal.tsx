import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Employee {
  id?: string;
  first_name: string;
  last_name: string;
  position?: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'volunteer';
  email?: string;
  phone_number?: string;
  address?: string;
  ssn_last_four?: string;
  hire_date?: string;
  termination_date?: string;
  salary_amount?: number;
  salary_frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'annual' | 'per-service';
  is_active: boolean;
  tax_id?: string;
  notes?: string;
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee?: Employee | null;
}

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  employee 
}) => {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Employee>({
    first_name: '',
    last_name: '',
    position: '',
    employment_type: 'part-time',
    email: '',
    phone_number: '',
    address: '',
    ssn_last_four: '',
    hire_date: '',
    termination_date: '',
    salary_amount: undefined,
    salary_frequency: undefined,
    is_active: true,
    tax_id: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (employee) {
        setFormData({
          first_name: employee.first_name || '',
          last_name: employee.last_name || '',
          position: employee.position || '',
          employment_type: employee.employment_type || 'part-time',
          email: employee.email || '',
          phone_number: employee.phone_number || '',
          address: employee.address || '',
          ssn_last_four: employee.ssn_last_four || '',
          hire_date: employee.hire_date || '',
          termination_date: employee.termination_date || '',
          salary_amount: employee.salary_amount,
          salary_frequency: employee.salary_frequency,
          is_active: employee.is_active !== undefined ? employee.is_active : true,
          tax_id: employee.tax_id || '',
          notes: employee.notes || ''
        });
      } else {
        // Reset form for new employee
        setFormData({
          first_name: '',
          last_name: '',
          position: '',
          employment_type: 'part-time',
          email: '',
          phone_number: '',
          address: '',
          ssn_last_four: '',
          hire_date: '',
          termination_date: '',
          salary_amount: undefined,
          salary_frequency: undefined,
          is_active: true,
          tax_id: '',
          notes: ''
        });
      }
      setError(null);
    }
  }, [isOpen, employee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? undefined : value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? undefined : parseFloat(value)
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) value = value.slice(0, 10);
    
    // Format as (XXX) XXX-XXXX
    let formatted = '';
    if (value.length > 0) {
      formatted = '(' + value.slice(0, 3);
      if (value.length > 3) {
        formatted += ') ' + value.slice(3, 6);
        if (value.length > 6) {
          formatted += '-' + value.slice(6);
        }
      }
    }
    
    setFormData(prev => ({
      ...prev,
      phone_number: formatted
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.ssn_last_four && !/^\d{4}$/.test(formData.ssn_last_four)) {
      setError('SSN last four must be exactly 4 digits');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();

      const requestBody: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        employment_type: formData.employment_type,
        is_active: formData.is_active
      };

      // Add optional fields only if they have values
      if (formData.position) requestBody.position = formData.position.trim();
      if (formData.email) requestBody.email = formData.email.trim();
      if (formData.phone_number) requestBody.phone_number = formData.phone_number.trim();
      if (formData.address) requestBody.address = formData.address.trim();
      if (formData.ssn_last_four) requestBody.ssn_last_four = formData.ssn_last_four;
      if (formData.hire_date) requestBody.hire_date = formData.hire_date;
      if (formData.termination_date) requestBody.termination_date = formData.termination_date;
      if (formData.salary_amount !== undefined) requestBody.salary_amount = formData.salary_amount;
      if (formData.salary_frequency) requestBody.salary_frequency = formData.salary_frequency;
      if (formData.tax_id) requestBody.tax_id = formData.tax_id.trim();
      if (formData.notes) requestBody.notes = formData.notes.trim();

      const url = employee?.id 
        ? `${process.env.REACT_APP_API_URL}/api/employees/${employee.id}`
        : `${process.env.REACT_APP_API_URL}/api/employees`;
      
      const method = employee?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.message || `Failed to ${employee?.id ? 'update' : 'create'} employee`);
      }
    } catch (err) {
      console.error('Error saving employee:', err);
      setError('An error occurred while saving the employee');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-2xl font-bold">
            {employee?.id ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {employee?.id ? 'Update employee information' : 'Add a new employee to the system'}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Position
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Priest, Deacon, Secretary"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employment Type <span className="text-red-500">*</span>
              </label>
              <select
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Employment Details */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hire Date
                </label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Termination Date
                </label>
                <input
                  type="date"
                  name="termination_date"
                  value={formData.termination_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Active Employee</span>
              </label>
            </div>
          </div>

          {/* Compensation */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compensation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salary Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="salary_amount"
                    value={formData.salary_amount || ''}
                    onChange={handleNumberChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salary Frequency
                </label>
                <select
                  name="salary_frequency"
                  value={formData.salary_frequency || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Frequency --</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="per-service">Per Service</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SSN Last Four
                </label>
                <input
                  type="text"
                  name="ssn_last_four"
                  value={formData.ssn_last_four}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData(prev => ({ ...prev, ssn_last_four: value }));
                  }}
                  placeholder="1234"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax ID / EIN
                </label>
                <input
                  type="text"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  placeholder="For 1099 contractors"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes about this employee..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : employee?.id ? 'Update Employee' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormModal;



