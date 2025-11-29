import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Vendor {
  id?: string;
  name: string;
  vendor_type: 'utility' | 'supplier' | 'service-provider' | 'contractor' | 'lender' | 'other';
  contact_person?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  website?: string;
  tax_id?: string;
  account_number?: string;
  payment_terms?: string;
  is_active: boolean;
  notes?: string;
}

interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendor?: Vendor | null;
}

const VendorFormModal: React.FC<VendorFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  vendor 
}) => {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Vendor>({
    name: '',
    vendor_type: 'other',
    contact_person: '',
    email: '',
    phone_number: '',
    address: '',
    website: '',
    tax_id: '',
    account_number: '',
    payment_terms: '',
    is_active: true,
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      if (vendor) {
        setFormData({
          name: vendor.name || '',
          vendor_type: vendor.vendor_type || 'other',
          contact_person: vendor.contact_person || '',
          email: vendor.email || '',
          phone_number: vendor.phone_number || '',
          address: vendor.address || '',
          website: vendor.website || '',
          tax_id: vendor.tax_id || '',
          account_number: vendor.account_number || '',
          payment_terms: vendor.payment_terms || '',
          is_active: vendor.is_active !== undefined ? vendor.is_active : true,
          notes: vendor.notes || ''
        });
      } else {
        // Reset form for new vendor
        setFormData({
          name: '',
          vendor_type: 'other',
          contact_person: '',
          email: '',
          phone_number: '',
          address: '',
          website: '',
          tax_id: '',
          account_number: '',
          payment_terms: '',
          is_active: true,
          notes: ''
        });
      }
      setError(null);
    }
  }, [isOpen, vendor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? undefined : value
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
    if (!formData.name.trim()) {
      setError('Vendor name is required');
      return false;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      setError('Please enter a valid website URL (starting with http:// or https://)');
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
        name: formData.name.trim(),
        vendor_type: formData.vendor_type,
        is_active: formData.is_active
      };

      // Add optional fields only if they have values
      if (formData.contact_person) requestBody.contact_person = formData.contact_person.trim();
      if (formData.email) requestBody.email = formData.email.trim();
      if (formData.phone_number) requestBody.phone_number = formData.phone_number.trim();
      if (formData.address) requestBody.address = formData.address.trim();
      if (formData.website) requestBody.website = formData.website.trim();
      if (formData.tax_id) requestBody.tax_id = formData.tax_id.trim();
      if (formData.account_number) requestBody.account_number = formData.account_number.trim();
      if (formData.payment_terms) requestBody.payment_terms = formData.payment_terms.trim();
      if (formData.notes) requestBody.notes = formData.notes.trim();

      const url = vendor?.id 
        ? `${process.env.REACT_APP_API_URL}/api/vendors/${vendor.id}`
        : `${process.env.REACT_APP_API_URL}/api/vendors`;
      
      const method = vendor?.id ? 'PUT' : 'POST';

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
        setError(data.message || `Failed to ${vendor?.id ? 'update' : 'create'} vendor`);
      }
    } catch (err) {
      console.error('Error saving vendor:', err);
      setError('An error occurred while saving the vendor');
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
            {vendor?.id ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {vendor?.id ? 'Update vendor information' : 'Add a new vendor to the system'}
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
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Type <span className="text-red-500">*</span>
              </label>
              <select
                name="vendor_type"
                value={formData.vendor_type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="utility">Utility</option>
                <option value="supplier">Supplier</option>
                <option value="service-provider">Service Provider</option>
                <option value="contractor">Contractor</option>
                <option value="lender">Lender</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
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

          {/* Business Details */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  placeholder="Church account number with vendor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Terms
                </label>
                <input
                  type="text"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleChange}
                  placeholder="e.g., Net 30, Due on receipt"
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
                  placeholder="Vendor tax ID or EIN"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center mt-6">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Vendor</span>
                </label>
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
              placeholder="Additional notes about this vendor..."
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
              {loading ? 'Saving...' : vendor?.id ? 'Update Vendor' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorFormModal;



