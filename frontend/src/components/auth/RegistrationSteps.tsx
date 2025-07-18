import React, { useState } from 'react';
import { formatPhoneNumber } from './MemberRegistration';
import { formatDateForDisplay } from '../../utils/dateUtils';

// Step 1: Personal Information
const PersonalInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('personalInfo')}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('first.name')} <span className="text-red-500">*</span>
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
          {t('middle.name')}
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
          {t('last.name')} <span className="text-red-500">*</span>
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
          {t('gender')} <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.gender}
          onChange={(e) => handleInputChange('gender', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Male">{t('male')}</option>
          <option value="Female">{t('female')}</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('date.of.birth')} <span className="text-red-500">*</span>
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
          {t('marital.status')} <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.maritalStatus}
          onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Single">{t('single')}</option>
          <option value="Married">{t('married')}</option>
          <option value="Divorced">{t('divorced')}</option>
          <option value="Widowed">{t('widowed')}</option>
        </select>
      </div>

      {/* Head of Household Question */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('head.of.household')}
          <span className="text-red-500">*</span>
        </label>
        <div className="mb-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
          {t('head.of.household.help')}
        </div>
        <div className="flex items-center gap-6">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="isHeadOfHousehold"
              checked={formData.isHeadOfHousehold === true}
              onChange={() => handleInputChange('isHeadOfHousehold', true)}
              className="form-radio"
            />
            <span className="ml-2">{t('yes')}</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="isHeadOfHousehold"
              checked={formData.isHeadOfHousehold === false}
              onChange={() => handleInputChange('isHeadOfHousehold', false)}
              className="form-radio"
            />
            <span className="ml-2">{t('no')}</span>
          </label>
        </div>
        {/* If not head of household, show head of household email */}
        {!formData.isHeadOfHousehold && (
          <div className="mt-2">
            <div className="mb-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
              {t('head.of.household.email.help')}
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('head.of.household.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.headOfHouseholdEmail || ''}
              onChange={(e) => handleInputChange('headOfHouseholdEmail', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.headOfHouseholdEmail ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="headofhousehold@email.com"
            />
            {errors.headOfHouseholdEmail && (
              <p className="text-red-500 text-sm mt-1">{errors.headOfHouseholdEmail}</p>
            )}
          </div>
        )}
      </div>

      {/* Has Dependents Question - Only show if head of household */}
      {formData.isHeadOfHousehold && (
        <div className="md:col-span-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="hasDependents"
              checked={formData.hasDependents}
              onChange={(e) => handleInputChange('hasDependents', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="hasDependents" className="ml-2 block text-sm font-medium text-gray-700">
              {t('has.dependents')}
            </label>
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {t('has.dependents.help')}
          </div>
        </div>
      )}
    </div>
  </div>
);

// Step 2: Contact & Address
const ContactAddressStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('contactAddress')}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('phone.number')} <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => {
            // Only allow up to 10 digits
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            handleInputChange('phoneNumber', formatPhoneNumber(digits));
          }}
          onBlur={(e) => {
            // Show error if not 10 digits on blur
            const digits = formData.phoneNumber.replace(/\D/g, '');
            if (digits.length > 0 && digits.length < 10) {
              handleInputChange('phoneNumber', formatPhoneNumber(formData.phoneNumber));
              // Optionally, set error here if not already set
              if (!errors.phoneNumber) {
                errors.phoneNumber = t('phone.number.invalid');
              }
            }
          }}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="(123) 456-7890"
        />
        {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('email.address')} <span className="text-red-500">*</span>
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
          {t('street.address')} <span className="text-red-500">*</span>
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
          {t('apartment.suite.number')}
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
          {t('city')} <span className="text-red-500">*</span>
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
          {t('state.province')} <span className="text-red-500">*</span>
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
          {t('postal.code')} <span className="text-red-500">*</span>
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
          {t('country')} <span className="text-red-500">*</span>
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
const FamilyInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('familyInfo')}</h3>
    <div className="space-y-4">
      {formData.maritalStatus === 'Married' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('spouse.name')}
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
              {t('spouse.email')}
            </label>
            <input
              type="email"
              value={formData.spouseEmail || ''}
              onChange={(e) => handleInputChange('spouseEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="spouse@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('spouse.contact.phone')}
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
              {t('emergency.contact.name')}
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
              {t('emergency.contact.phone')}
            </label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => {
                // Only allow up to 10 digits
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                handleInputChange('emergencyContactPhone', formatPhoneNumber(digits));
              }}
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
const SpiritualInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('spiritualInfo')}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('date.joined.parish')}
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
          {t('baptism.name')}
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
          {t('interested.in.serving')}
        </label>
        <select
          value={formData.interestedInServing || ''}
          onChange={(e) => handleInputChange('interestedInServing', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">{t('select')}</option>
          <option value="Yes">{t('yes')}</option>
          <option value="No">{t('no')}</option>
          <option value="Maybe">{t('maybe')}</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('language.preference')}
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
const ContributionStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('contributionInfo')}</h3>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('preferred.giving.method')}
        </label>
        <select
          value={formData.preferredGivingMethod}
          onChange={(e) => handleInputChange('preferredGivingMethod', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="Cash">{t('cash')}</option>
          <option value="Online">{t('online')}</option>
          <option value="Check">{t('check')}</option>
        </select>
      </div>
      {/* Removed titheParticipation checkbox and member ID info/help box */}
    </div>
  </div>
);

// Step 6: Account Information
const AccountStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-gray-800">{t('accountInfo')}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('login.email')} <span className="text-red-500">*</span>
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
          {t('password')} <span className="text-red-500">*</span>
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
          {t('confirm.password')} <span className="text-red-500">*</span>
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
      <h4 className="font-medium text-yellow-900 mb-2">{t('password.requirements')}</h4>
      <ul className="text-sm text-yellow-700 space-y-1">
        <li>• {t('at.least.8.characters')}</li>
        <li>• {t('contains.at.least.one.uppercase')}</li>
        <li>• {t('contains.at.least.one.lowercase')}</li>
        <li>• {t('contains.at.least.one.number')}</li>
      </ul>
    </div>
    
  </div>
);

interface Dependant {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
}

interface DependantsStepProps {
  dependants: Dependant[];
  onDependantsChange: (dependants: Dependant[]) => void;
  errors?: any;
  t: any;
}

const DependantsStep: React.FC<DependantsStepProps> = ({ dependants, onDependantsChange, errors, t }) => {
  const [newDependant, setNewDependant] = useState<Dependant>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    email: '',
    baptismName: '',
    isBaptized: false
  });

  const addDependant = () => {
    if (newDependant.firstName && newDependant.lastName && newDependant.dateOfBirth) {
      onDependantsChange([...dependants, newDependant]);
      setNewDependant({
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'Male',
        phone: '',
        email: '',
        baptismName: '',
        isBaptized: false
      });
    }
  };

  const removeDependant = (index: number) => {
    onDependantsChange(dependants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dependants')}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('dependants.help')}
        </p>
      </div>

      {/* Add New Dependant Form */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-4">{t('add.new.dependant')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('first.name')} *
            </label>
            <input
              type="text"
              value={newDependant.firstName}
              onChange={(e) => setNewDependant({...newDependant, firstName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('middle.name')}
            </label>
            <input
              type="text"
              value={newDependant.middleName || ''}
              onChange={(e) => setNewDependant({...newDependant, middleName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('last.name')} *
            </label>
            <input
              type="text"
              value={newDependant.lastName}
              onChange={(e) => setNewDependant({...newDependant, lastName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('date.of.birth')} *
            </label>
            <input
              type="date"
              value={newDependant.dateOfBirth}
              onChange={(e) => setNewDependant({...newDependant, dateOfBirth: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('gender')} *
            </label>
            <select
              value={newDependant.gender}
              onChange={(e) => setNewDependant({...newDependant, gender: e.target.value as 'Male' | 'Female'})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Male">{t('male')}</option>
              <option value="Female">{t('female')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('phone')}
            </label>
            <input
              type="tel"
              value={newDependant.phone || ''}
              onChange={(e) => setNewDependant({...newDependant, phone: formatPhoneNumber(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              type="email"
              value={newDependant.email || ''}
              onChange={(e) => setNewDependant({...newDependant, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('baptism.name')}
            </label>
            <input
              type="text"
              value={newDependant.baptismName || ''}
              onChange={(e) => setNewDependant({...newDependant, baptismName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isBaptized"
              checked={newDependant.isBaptized}
              onChange={(e) => setNewDependant({...newDependant, isBaptized: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isBaptized" className="ml-2 block text-sm text-gray-900">
              {t('is.baptized')}
            </label>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={addDependant}
            disabled={!newDependant.firstName || !newDependant.lastName || !newDependant.dateOfBirth}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('add.dependant')}
          </button>
        </div>
      </div>

      {/* Existing Dependants List */}
      {dependants.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">{t('added.dependants')}</h4>
          <div className="space-y-3">
            {dependants.map((dependant, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">
                      {dependant.firstName} {dependant.middleName} {dependant.lastName}
                    </h5>
                    <p className="text-sm text-gray-600">
                      {t('born')}: {formatDateForDisplay(dependant.dateOfBirth)} | 
                      {t('gender')}: {dependant.gender} | 
                      {t('baptized')}: {dependant.isBaptized ? t('yes') : t('no')}
                    </p>
                    {dependant.baptismName && (
                      <p className="text-sm text-gray-600">
                        {t('baptism.name')}: {dependant.baptismName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDependant(index)}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    {t('remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dependants.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{t('no.dependants.added')}</p>
          <p className="text-sm mt-2">{t('add.dependants.now')}</p>
        </div>
             )}
     </div>
   );
 };

export {
  PersonalInfoStep,
  ContactAddressStep,
  FamilyInfoStep,
  DependantsStep,
  SpiritualInfoStep,
  ContributionStep,
  AccountStep
}; 