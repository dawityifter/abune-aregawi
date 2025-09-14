import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatPhoneNumber } from '../utils/formatPhoneNumber';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  streetLine1?: string;
  postalCode?: string;
  role: string;
  isActive: boolean;
}

interface PledgeFormData {
  amount: string;
  pledge_type: 'general' | 'event' | 'fundraising' | 'tithe';
  event_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: string;
  zip_code?: string;
  notes?: string;
  member_id?: string; // For linking to existing member
}

interface PledgeFormProps {
  onSubmit: (data: PledgeFormData) => Promise<void>;
  loading: boolean;
  eventName?: string; // Optional pre-filled event name
}

const PledgeForm: React.FC<PledgeFormProps> = ({ onSubmit, loading, eventName }) => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('');

  const [formData, setFormData] = useState<PledgeFormData>({
    amount: '',
    pledge_type: eventName ? 'event' : 'fundraising', // Temporarily default to fundraising
    event_name: eventName || '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    zip_code: '',
    notes: '',
    member_id: ''
  });
  const [errors, setErrors] = useState<Partial<PledgeFormData>>({});

  // Check if user has admin or treasurer permissions
  const userRole = currentUser?.role || 'member';
  const isAdminOrTreasurer = ['admin', 'treasurer'].includes(userRole);

  // Fetch members if user is admin/treasurer
  useEffect(() => {
    const fetchMembers = async () => {
      if (isAdminOrTreasurer && firebaseUser) {
        try {
          setLoadingMembers(true);
          console.log('🔍 Fetching members for dropdown...');
          
          // Get Firebase ID token
          const idToken = await firebaseUser.getIdToken();
          console.log('🔑 Got Firebase token, making API call...');
          
          const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=1000`;
          console.log('🌐 API URL:', apiUrl);
          
          const response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📡 API Response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
            return;
          }
          
          const data = await response.json();
          console.log('📊 Full API Response data:', JSON.stringify(data, null, 2));
          
          if (data.success) {
            const memberList = data.data?.members || [];
            console.log('👥 Member list from response:', memberList);
            console.log('👥 Members loaded:', memberList.length);
            setMembers(memberList);
          } else {
            console.error('❌ API returned success=false:', data);
          }
        } catch (error) {
          console.error('❌ Error fetching members:', error);
        } finally {
          setLoadingMembers(false);
        }
      } else {
        console.log('ℹ️ Not fetching members - user is not admin/treasurer or not authenticated');
        console.log('👤 User role:', userRole);
        console.log('🔐 Is admin/treasurer:', isAdminOrTreasurer);
        console.log('👨‍💼 Firebase user:', !!firebaseUser);
      }
    };

    fetchMembers();
  }, [isAdminOrTreasurer, firebaseUser, userRole]);

  const validateForm = (): boolean => {
    const newErrors: Partial<PledgeFormData> = {};

    if (!formData.amount || parseFloat(formData.amount) < 1) {
      newErrors.amount = 'Amount must be at least $1.00';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation only for non-members
    if (!selectedMember && !formData.phone.trim()) {
      newErrors.phone = 'Phone number is required for new members';
    }

    // Address and ZIP validation only for non-members
    if (!selectedMember && (!formData.address || !formData.address.trim())) {
      newErrors.address = 'Address is required for new members';
    }

    if (!selectedMember && (!formData.zip_code || !formData.zip_code.trim())) {
      newErrors.zip_code = 'ZIP code is required for new members';
    }

    // Address and ZIP validation for members (can be empty or modified)
    // No validation required for members since we allow modification

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
      // Form will be reset by parent component on success
    } catch (error) {
      console.error('Pledge submission error:', error);
    }
  };

  const handleInputChange = (field: keyof PledgeFormData, value: string) => {
    // Apply phone formatting for phone field
    if (field === 'phone') {
      value = formatPhoneNumber(value);
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleMemberSelect = (memberId: string) => {
    setSelectedMember(memberId);
    
    if (memberId) {
      const selectedMemberData = members.find(m => m.id === memberId);
      if (selectedMemberData) {
        console.log('👤 Selected member data:', selectedMemberData);
        setFormData(prev => ({
          ...prev,
          member_id: selectedMemberData.id,
          first_name: selectedMemberData.firstName,
          last_name: selectedMemberData.lastName,
          email: selectedMemberData.email,
          phone: selectedMemberData.phoneNumber,
          address: selectedMemberData.streetLine1 || '',
          zip_code: selectedMemberData.postalCode || ''
        }));
        console.log('📝 Form data updated with member info');
      }
    } else {
      // Clear member selection and form fields
      setFormData(prev => ({
        ...prev,
        member_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        zip_code: ''
      }));
      console.log('🧹 Member selection cleared');
    }
  };

  const suggestedAmounts = [25, 50, 100, 250, 500, 1000];

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Make a Pledge</h2>
        <p className="text-gray-600">Support our church with your generous pledge</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Member Selection for Admins/Treasurers */}
        {isAdminOrTreasurer && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Member (Optional)
            </label>
            <select
              value={selectedMember}
              onChange={(e) => handleMemberSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={loadingMembers}
            >
              <option value="">
                {loadingMembers ? 'Loading members...' : 'Select existing member or leave blank for new'}
              </option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} - {member.phoneNumber}
                </option>
              ))}
            </select>
            {selectedMember && (
              <button
                type="button"
                onClick={() => handleMemberSelect('')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection to enter new member info
              </button>
            )}
          </div>
        )}

        {/* Pledge Type - Temporarily Hidden */}
        {/*
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pledge Type *
          </label>
          <select
            value={formData.pledge_type}
            onChange={(e) => handleInputChange('pledge_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="general">General Donation</option>
            <option value="tithe">Tithe</option>
            <option value="event">Event Support</option>
            <option value="fundraising">Fundraising Campaign</option>
          </select>
        </div>
        */}

        {/* Event Name (conditional) */}
        {formData.pledge_type === 'event' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              value={formData.event_name}
              onChange={(e) => handleInputChange('event_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.event_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Sunday Fundraising Event"
            />
            {errors.event_name && (
              <p className="mt-1 text-sm text-red-600">{errors.event_name}</p>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pledge Amount *
          </label>

          {/* Suggested amounts */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {suggestedAmounts.map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => handleInputChange('amount', amount.toString())}
                className={`px-4 py-2 text-sm border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  formData.amount === amount.toString() ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>

          {/* Custom amount input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter custom amount"
              min="1"
              step="0.01"
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
          )}
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.first_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.last_name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
            )}
          </div>
        </div>

        {/* Email and Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {!selectedMember && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="(555) 555-1234"
                inputMode="tel"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>
          )}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address {selectedMember ? '(Auto-filled from member)' : '(Required)'}
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            } ${selectedMember ? 'bg-blue-50' : ''}`}
            placeholder={selectedMember ? 'Auto-filled from member' : 'Street address'}
          />
          {errors.address && (
            <p className="mt-1 text-sm text-red-600">{errors.address}</p>
          )}
          {selectedMember && (
            <p className="mt-1 text-xs text-blue-600">
              Address from selected member - you can modify if needed
            </p>
          )}
        </div>

        {/* ZIP Code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ZIP Code {selectedMember ? '(Auto-filled from member)' : '(Required)'}
            </label>
            <input
              type="text"
              value={formData.zip_code}
              onChange={(e) => handleInputChange('zip_code', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.zip_code ? 'border-red-500' : 'border-gray-300'
              } ${selectedMember ? 'bg-blue-50' : ''}`}
              placeholder={selectedMember ? 'Auto-filled from member' : '12345'}
            />
            {errors.zip_code && (
              <p className="mt-1 text-sm text-red-600">{errors.zip_code}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={3}
            placeholder="Any additional notes or dedication..."
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-2 focus:ring-primary-500'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              `Pledge $${formData.amount || '0'}`
            )}
          </button>
        </div>

        {/* Terms */}
        <div className="text-center text-sm text-gray-600">
          <p>
            By making this pledge, you agree to our terms and conditions.
            You will receive a confirmation email with payment instructions.
          </p>
        </div>
      </form>
    </div>
  );
};

export default PledgeForm;
