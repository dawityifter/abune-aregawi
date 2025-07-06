import React, { useState } from 'react';
import { formatPhoneNumber } from './MemberRegistration';

// Step 1: Personal Information
export const PersonalInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.personalInfo}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          First Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => handleInputChange('firstName', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.firstName ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Middle Name
        </label>
        <input
          type="text"
          value={formData.middleName}
          onChange={(e) => handleInputChange('middleName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Last Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => handleInputChange('lastName', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.lastName ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gender <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.gender}
          onChange={(e) => handleInputChange('gender', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Marital Status <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.maritalStatus}
          onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
        </select>
      </div>
    </div>
  </div>
);

// Step 2: Contact & Address
export const ContactAddressStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.contactAddress}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="(555) 123-4567"
        />
        {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>
      
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Street Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.streetLine1}
          onChange={(e) => handleInputChange('streetLine1', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.streetLine1 ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.streetLine1 && <p className="text-red-500 text-sm mt-1">{errors.streetLine1}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Apartment/Suite Number
        </label>
        <input
          type="text"
          value={formData.apartmentNo}
          onChange={(e) => handleInputChange('apartmentNo', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Apt 123"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          City <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => handleInputChange('city', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.city ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          State/Province <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.state}
          onChange={(e) => handleInputChange('state', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.state ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Postal Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.postalCode}
          onChange={(e) => handleInputChange('postalCode', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.postalCode ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.postalCode && <p className="text-red-500 text-sm mt-1">{errors.postalCode}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.country}
          onChange={(e) => handleInputChange('country', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.country ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country}</p>}
      </div>
    </div>
  </div>
);

// Step 3: Family Information
export const FamilyInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.familyInfo}</h3>
    <div className="space-y-4">
      {formData.maritalStatus === 'Married' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spouse Name
            </label>
            <input
              type="text"
              value={formData.spouseName}
              onChange={(e) => handleInputChange('spouseName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spouse Contact Phone
            </label>
            <input
              type="tel"
              value={formData.spouseContactPhone || ''}
              onChange={(e) => handleInputChange('spouseContactPhone', formatPhoneNumber(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="(555) 123-4567"
            />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Name
            </label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact Phone
            </label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => handleInputChange('emergencyContactPhone', formatPhoneNumber(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
      )}
    </div>
  </div>
);

// Step 4: Spiritual Information
export const SpiritualInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.spiritualInfo}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date Joined Parish (Estimated)
        </label>
        <input
          type="date"
          value={formData.dateJoinedParish}
          onChange={(e) => handleInputChange('dateJoinedParish', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Baptism Name
        </label>
        <input
          type="text"
          value={formData.baptismName || ''}
          onChange={(e) => handleInputChange('baptismName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Enter Baptism Name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Interested in Serving?
        </label>
        <select
          value={formData.interestedInServing || ''}
          onChange={(e) => handleInputChange('interestedInServing', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Maybe">Maybe</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Language Preference
        </label>
        <select
          value={formData.languagePreference || 'English'}
          onChange={(e) => handleInputChange('languagePreference', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="English">English</option>
          <option value="Tigrigna">Tigrigna</option>
          <option value="Amharic">Amharic</option>
        </select>
      </div>
    </div>
  </div>
);

// Step 5: Contribution & Giving
export const ContributionStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.contributionInfo}</h3>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Preferred Giving Method
        </label>
        <select
          value={formData.preferredGivingMethod}
          onChange={(e) => handleInputChange('preferredGivingMethod', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Cash">Cash</option>
          <option value="Online">Online</option>
          <option value="Envelope">Envelope</option>
          <option value="Check">Check</option>
        </select>
      </div>
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="titheParticipation"
          checked={formData.titheParticipation}
          onChange={(e) => handleInputChange('titheParticipation', e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="titheParticipation" className="ml-2 text-sm text-gray-700">
          Participate in Tithe/Pledge Program
        </label>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-md">
        <h4 className="font-medium text-blue-900 mb-2">Member ID Information</h4>
        <p className="text-sm text-blue-700">
          A unique member ID will be automatically generated upon registration. 
          This ID will be used for envelope tracking and contribution records.
        </p>
      </div>
    </div>
  </div>
);

// Step 6: Account Information
export const AccountStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t.accountInfo}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Login Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.loginEmail}
          onChange={(e) => handleInputChange('loginEmail', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.loginEmail ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.loginEmail && <p className="text-red-500 text-sm mt-1">{errors.loginEmail}</p>}
      </div>
      
      <div className="md:col-span-2"></div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.password ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
      </div>
    </div>
    
    <div className="bg-yellow-50 p-4 rounded-md">
      <h4 className="font-medium text-yellow-900 mb-2">Password Requirements</h4>
      <ul className="text-sm text-yellow-700 space-y-1">
        <li>• At least 8 characters long</li>
        <li>• Contains at least one uppercase letter</li>
        <li>• Contains at least one lowercase letter</li>
        <li>• Contains at least one number</li>
      </ul>
    </div>
    
    <div className="bg-green-50 p-4 rounded-md">
      <h4 className="font-medium text-green-900 mb-2">Account Access</h4>
      <p className="text-sm text-green-700">
        After registration, you'll be able to access your member portal to view your profile, 
        update information, and manage your contributions.
      </p>
    </div>
  </div>
);

interface Child {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
}

interface ChildrenStepProps {
  children: Child[];
  onChildrenChange: (children: Child[]) => void;
  errors?: any;
}

export const ChildrenStep: React.FC<ChildrenStepProps> = ({ children, onChildrenChange, errors }) => {
  const [newChild, setNewChild] = useState<Child>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    email: '',
    baptismName: '',
    isBaptized: false,
    baptismDate: '',
    nameDay: ''
  });

  const addChild = () => {
    if (newChild.firstName && newChild.lastName && newChild.dateOfBirth) {
      onChildrenChange([...children, newChild]);
      setNewChild({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'Male',
        phone: '',
        email: '',
        baptismName: '',
        isBaptized: false,
        baptismDate: '',
        nameDay: ''
      });
    }
  };

  const removeChild = (index: number) => {
    onChildrenChange(children.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Children & Dependents</h3>
        <p className="text-sm text-gray-600 mb-6">
          Add information about your children or dependents. This is optional and can be updated later.
        </p>
      </div>

      {/* Add New Child Form */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-4">Add New Child</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              value={newChild.firstName}
              onChange={(e) => setNewChild({...newChild, firstName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Middle Name
            </label>
            <input
              type="text"
              value={newChild.middleName || ''}
              onChange={(e) => setNewChild({...newChild, middleName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              value={newChild.lastName}
              onChange={(e) => setNewChild({...newChild, lastName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              value={newChild.dateOfBirth}
              onChange={(e) => setNewChild({...newChild, dateOfBirth: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender *
            </label>
            <select
              value={newChild.gender}
              onChange={(e) => setNewChild({...newChild, gender: e.target.value as 'Male' | 'Female'})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={newChild.phone || ''}
              onChange={(e) => setNewChild({...newChild, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={newChild.email || ''}
              onChange={(e) => setNewChild({...newChild, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Baptism Name
            </label>
            <input
              type="text"
              value={newChild.baptismName || ''}
              onChange={(e) => setNewChild({...newChild, baptismName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Baptism Date
            </label>
            <input
              type="date"
              value={newChild.baptismDate || ''}
              onChange={(e) => setNewChild({...newChild, baptismDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name Day
            </label>
            <input
              type="text"
              value={newChild.nameDay || ''}
              onChange={(e) => setNewChild({...newChild, nameDay: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isBaptized"
              checked={newChild.isBaptized}
              onChange={(e) => setNewChild({...newChild, isBaptized: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isBaptized" className="ml-2 block text-sm text-gray-900">
              Is Baptized
            </label>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={addChild}
            disabled={!newChild.firstName || !newChild.lastName || !newChild.dateOfBirth}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add Child
          </button>
        </div>
      </div>

      {/* Existing Children List */}
      {children.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Added Children</h4>
          <div className="space-y-3">
            {children.map((child, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">
                      {child.firstName} {child.middleName} {child.lastName}
                    </h5>
                    <p className="text-sm text-gray-600">
                      Born: {new Date(child.dateOfBirth).toLocaleDateString()} | 
                      Gender: {child.gender} | 
                      Baptized: {child.isBaptized ? 'Yes' : 'No'}
                    </p>
                    {child.baptismName && (
                      <p className="text-sm text-gray-600">
                        Baptism Name: {child.baptismName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {children.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No children added yet.</p>
          <p className="text-sm mt-2">You can add children now or manage them later from your dashboard.</p>
        </div>
             )}
     </div>
   );
 };

 export {
   PersonalInfoStep,
   ContactAddressStep,
   FamilyInfoStep,
   ChildrenStep,
   SpiritualInfoStep,
   ContributionStep,
   AccountStep
 }; 