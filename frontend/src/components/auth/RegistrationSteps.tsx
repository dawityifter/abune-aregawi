import React, { useState } from 'react';
import { formatPhoneNumber, normalizePhoneNumber, isValidPhoneNumber } from '../../utils/formatPhoneNumber';
import { formatDateForDisplay } from '../../utils/dateUtils';

// Step 1: Personal Information
const PersonalInfoStep: React.FC<{
  formData: any;
  handleInputChange: (field: any, value: any) => void;
  errors: any;
  t: any;
}> = ({ formData, handleInputChange, errors, t }) => (
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{t('personalInfo')}</h3>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('first.name')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => handleInputChange('firstName', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('enter.first.name')}
        />
        {errors.firstName && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.firstName}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('middle.name')}
        </label>
        <input
          type="text"
          value={formData.middleName}
          onChange={(e) => handleInputChange('middleName', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('enter.middle.name')}
        />
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('last.name')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => handleInputChange('lastName', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('enter.last.name')}
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
          <option value="">{t('select.gender')}</option>
          <option value="Male">{t('male')}</option>
          <option value="Female">{t('female')}</option>
        </select>
        {errors.gender && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.gender}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('date.of.birth')} <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.dateOfBirth 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
        />
        {errors.dateOfBirth && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.dateOfBirth}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('marital.status')} <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.maritalStatus}
          onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.maritalStatus 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
        >
          <option value="">{t('select.marital.status')}</option>
          <option value="Single">{t('single')}</option>
          <option value="Married">{t('married')}</option>
          <option value="Divorced">{t('divorced')}</option>
          <option value="Widowed">{t('widowed')}</option>
        </select>
        {errors.maritalStatus && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.maritalStatus}
          </p>
        )}
      </div>

      {/* Head of Household Question */}
      <div className="space-y-2 sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('head.of.household')}
          <span className="text-red-500">*</span>
        </label>
        <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-3 mb-2">
          {t('head.of.household.help')}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <label className="inline-flex items-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="isHeadOfHousehold"
              checked={formData.isHeadOfHousehold === true}
              onChange={() => handleInputChange('isHeadOfHousehold', true)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm sm:text-base">{t('yes')}</span>
          </label>
          <label className="inline-flex items-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="isHeadOfHousehold"
              checked={formData.isHeadOfHousehold === false}
              onChange={() => handleInputChange('isHeadOfHousehold', false)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm sm:text-base">{t('no')}</span>
          </label>
        </div>
        {errors.isHeadOfHousehold && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.isHeadOfHousehold}
          </p>
        )}
        {/* If not head of household, show head of household email */}
        {!formData.isHeadOfHousehold && (
          <div className="mt-3 space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('head.of.household.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.headOfHouseholdEmail}
              onChange={(e) => handleInputChange('headOfHouseholdEmail', e.target.value)}
              className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
                errors.headOfHouseholdEmail 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } focus:outline-none focus:ring-1`}
              placeholder={t('enter.head.of.household.email')}
            />
            {errors.headOfHouseholdEmail && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.headOfHouseholdEmail}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {t('head.of.household.email.help')}
            </p>
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
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{t('contactAddress')}</h3>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('phone.number')} <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phoneNumber}
          readOnly
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-base sm:text-sm"
          placeholder={t('phone.number.placeholder')}
        />
        {errors.phoneNumber && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.phoneNumber}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {t('phone.number.from.authentication')}
        </p>
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('email.address')} <span className="text-gray-500 text-xs">({t('optional')})</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.email 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('email.placeholder')}
        />
        {errors.email && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.email}
          </p>
        )}
      </div>
      
      <div className="sm:col-span-2 space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('address.line1')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.addressLine1}
          onChange={(e) => handleInputChange('addressLine1', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.addressLine1 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('address.line1.placeholder')}
        />
        {errors.addressLine1 && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.addressLine1}
          </p>
        )}
      </div>
      
      <div className="sm:col-span-2 space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('address.line2')} <span className="text-gray-500 text-xs">({t('optional')})</span>
        </label>
        <input
          type="text"
          value={formData.addressLine2}
          onChange={(e) => handleInputChange('addressLine2', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('address.line2.placeholder')}
        />
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('city')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => handleInputChange('city', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.city 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('city.placeholder')}
        />
        {errors.city && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.city}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('state.province')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.state}
          onChange={(e) => handleInputChange('state', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.state 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('state.province.placeholder')}
        />
        {errors.state && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.state}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('postal.code')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.postalCode}
          onChange={(e) => handleInputChange('postalCode', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.postalCode 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('postal.code.placeholder')}
        />
        {errors.postalCode && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.postalCode}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('country')} <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.country}
          onChange={(e) => handleInputChange('country', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.country 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
        >
          <option value="">{t('select.country')}</option>
          <option value="United States">United States</option>
          <option value="Canada">Canada</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="Australia">Australia</option>
          <option value="Other">{t('other')}</option>
        </select>
        {errors.country && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.country}
          </p>
        )}
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
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{t('familyInfo')}</h3>
    <div className="space-y-3 sm:space-y-4">
      {formData.maritalStatus === 'Married' ? (
        <>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('spouse.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.spouseName}
              onChange={(e) => handleInputChange('spouseName', e.target.value)}
              className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
                errors.spouseName 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } focus:outline-none focus:ring-1`}
              placeholder={t('spouse.name.placeholder')}
            />
            {errors.spouseName && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.spouseName}
              </p>
            )}
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('spouse.email')} <span className="text-gray-500 text-xs">({t('optional')})</span>
            </label>
            <input
              type="email"
              value={formData.spouseEmail || ''}
              onChange={(e) => handleInputChange('spouseEmail', e.target.value)}
              className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
                errors.spouseEmail 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } focus:outline-none focus:ring-1`}
              placeholder={t('spouse.email.placeholder')}
            />
            {errors.spouseEmail && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.spouseEmail}
              </p>
            )}
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('spouse.contact.phone')} <span className="text-gray-500 text-xs">({t('optional')})</span>
            </label>
            <input
              type="tel"
              value={formatPhoneNumber(formData.spousePhone || '')}
              onChange={(e) => {
                const normalized = normalizePhoneNumber(e.target.value);
                if (normalized === '' || !isNaN(Number(normalized))) {
                  handleInputChange('spousePhone', normalized);
                }
              }}
              className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
                errors.spousePhone 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } focus:outline-none focus:ring-1`}
              placeholder={t('phone.placeholder')}
            />
            {errors.spousePhone && (
              <p className="text-red-500 text-xs sm:text-sm mt-1">
                {errors.spousePhone}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('emergency.contact.name')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.emergencyContactName}
              onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.emergencyContactName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.emergencyContactName && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('emergency.contact.phone')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => {
                // Only allow up to 10 digits
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                handleInputChange('emergencyContactPhone', formatPhoneNumber(digits));
              }}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.emergencyContactPhone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="(555) 123-4567"
            />
            {errors.emergencyContactPhone && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactPhone}</p>}
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('number.of.children')} <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.numberOfChildren}
          onChange={(e) => handleInputChange('numberOfChildren', parseInt(e.target.value) || 0)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.numberOfChildren 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
        {errors.numberOfChildren && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.numberOfChildren}
          </p>
        )}
      </div>
      
      {formData.numberOfChildren > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm sm:text-base font-medium text-gray-700">
            {t('children.ages')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: formData.numberOfChildren }, (_, i) => (
              <div key={i} className="space-y-1">
                <label className="block text-xs sm:text-sm text-gray-600">
                  {t('child')} {i + 1}
                </label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={formData.childrenAges?.[i] || ''}
                  onChange={(e) => {
                    const newAges = [...(formData.childrenAges || [])];
                    newAges[i] = parseInt(e.target.value) || 0;
                    handleInputChange('childrenAges', newAges);
                  }}
                  className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('age')}
                />
              </div>
            ))}
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
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
      {t('spiritualInfo')}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('date.joined.parish')}
        </label>
        <input
          type="date"
          value={formData.dateJoinedParish || ''}
          onChange={(e) => handleInputChange('dateJoinedParish', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('baptism.name')}
        </label>
        <input
          type="text"
          value={formData.baptismName || ''}
          onChange={(e) => handleInputChange('baptismName', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder={t('baptism.name.placeholder')}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('interested.in.serving')}
        </label>
        <select
          value={formData.interestedInServing || ''}
          onChange={(e) => handleInputChange('interestedInServing', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{t('select')}</option>
          <option value="Yes">{t('yes')}</option>
          <option value="No">{t('no')}</option>
          <option value="Maybe">{t('maybe')}</option>
        </select>
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('language.preference')}
        </label>
        <select
          value={formData.languagePreference || 'English'}
          onChange={(e) => handleInputChange('languagePreference', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
      {t('contributionInfo')}
    </h3>
    
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('preferred.giving.method')}
        </label>
        <select
          value={formData.preferredGivingMethod}
          onChange={(e) => handleInputChange('preferredGivingMethod', e.target.value)}
          className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{t('select.giving.method')}</option>
          <option value="Cash">{t('cash')}</option>
          <option value="Online">{t('online')}</option>
          <option value="Check">{t('check')}</option>
        </select>
      </div>
      
      <div className="pt-1">
        <label className="flex items-start space-x-3">
          <div className="flex items-center h-5 mt-0.5">
            <input
              type="checkbox"
              checked={formData.titheParticipation || false}
              onChange={(e) => handleInputChange('titheParticipation', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <span className="text-sm sm:text-base text-gray-700">
            {t('participate.in.tithe') || 'I would like to participate in tithing'}
          </span>
        </label>
        {formData.titheParticipation && (
          <p className="mt-2 text-xs sm:text-sm text-gray-500 pl-7">
            {t('tithe.participation.note') || 'Thank you for your commitment to tithing. You can update your preferences at any time in your account settings.'}
          </p>
        )}
      </div>
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
  <div className="space-y-4 sm:space-y-6">
    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
      {t('accountInfo')}
    </h3>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div className="sm:col-span-2 space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('login.email')} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.loginEmail}
          onChange={(e) => handleInputChange('loginEmail', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.loginEmail 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder={t('email.placeholder') || 'your@email.com'}
          autoComplete="username"
        />
        {errors.loginEmail && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.loginEmail}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('password')} <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange('password', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.password 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {errors.password && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.password}
          </p>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('confirm.password')} <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          className={`w-full px-3 py-2 sm:py-2.5 border rounded-lg text-base sm:text-sm ${
            errors.confirmPassword 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-1`}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs sm:text-sm mt-1">
            {errors.confirmPassword}
          </p>
        )}
      </div>
    </div>
    
    <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border border-yellow-100">
      <h4 className="text-sm sm:text-base font-medium text-yellow-900 mb-2">
        {t('password.requirements')}
      </h4>
      <ul className="text-xs sm:text-sm text-yellow-700 space-y-1">
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>{t('at.least.8.characters')}</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>{t('contains.at.least.one.uppercase')}</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>{t('contains.at.least.one.lowercase')}</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>{t('contains.at.least.one.number')}</span>
        </li>
      </ul>
    </div>
  </div>
);

interface Dependent {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  relationship?: string;
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
}

interface DependentsStepProps {
  dependents: Dependent[];
  onDependentsChange: (dependents: Dependent[]) => void;
  errors?: any;
  t: any;
}

const DependentsStep: React.FC<DependentsStepProps> = ({ dependents, onDependentsChange, errors, t }) => {
  const [newDependent, setNewDependent] = useState<Dependent>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    relationship: '',
    phone: '',
    email: '',
    baptismName: '',
    isBaptized: false,
    baptismDate: '',
    nameDay: '',
    medicalConditions: '',
    allergies: '',
    medications: '',
    dietaryRestrictions: '',
    notes: ''
  });

  const addDependent = () => {
    if (newDependent.firstName && newDependent.lastName && newDependent.dateOfBirth) {
      onDependentsChange([...dependents, newDependent]);
      setNewDependent({
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

  const removeDependent = (index: number) => {
    onDependentsChange(dependents.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dependents')}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t('dependents.help')}
        </p>
      </div>

      {/* Add New Dependant Form */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-4">{t('add.new.dependent')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('first.name')} *
            </label>
            <input
              type="text"
              value={newDependent.firstName}
              onChange={(e) => setNewDependent({...newDependent, firstName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('middle.name')}
            </label>
            <input
              type="text"
              value={newDependent.middleName || ''}
              onChange={(e) => setNewDependent({...newDependent, middleName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('last.name')} *
            </label>
            <input
              type="text"
              value={newDependent.lastName}
              onChange={(e) => setNewDependent({...newDependent, lastName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('date.of.birth')} *
            </label>
            <input
              type="date"
              value={newDependent.dateOfBirth}
              onChange={(e) => setNewDependent({...newDependent, dateOfBirth: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('gender')} *
            </label>
            <select
              value={newDependent.gender}
              onChange={(e) => setNewDependent({...newDependent, gender: e.target.value as 'Male' | 'Female'})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Male">{t('male')}</option>
              <option value="Female">{t('female')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('relationship')}
            </label>
            <input
              type="text"
              value={newDependent.relationship || ''}
              onChange={(e) => setNewDependent({...newDependent, relationship: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('phone')}
            </label>
            <input
              type="tel"
              value={newDependent.phone || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                setNewDependent({...newDependent, phone: formatPhoneNumber(digits)});
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
              maxLength={14}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              type="email"
              value={newDependent.email || ''}
              onChange={(e) => setNewDependent({...newDependent, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('baptism.name')}
            </label>
            <input
              type="text"
              value={newDependent.baptismName || ''}
              onChange={(e) => setNewDependent({...newDependent, baptismName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('baptism.date')}
            </label>
            <input
              type="date"
              value={newDependent.baptismDate || ''}
              onChange={(e) => setNewDependent({...newDependent, baptismDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('name.day')}
            </label>
            <input
              type="text"
              value={newDependent.nameDay || ''}
              onChange={(e) => setNewDependent({...newDependent, nameDay: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isBaptized"
              checked={newDependent.isBaptized}
              onChange={(e) => setNewDependent({...newDependent, isBaptized: e.target.checked})}
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
                          onClick={addDependent}
                          disabled={!newDependent.firstName || !newDependent.lastName || !newDependent.dateOfBirth}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('add.dependent')}
          </button>
        </div>
      </div>

      {/* Existing Dependents List */}
      {dependents.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">{t('added.dependents')}</h4>
          <div className="space-y-3">
            {dependents.map((dependent, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">
                      {dependent.firstName} {dependent.middleName} {dependent.lastName}
                    </h5>
                    <p className="text-sm text-gray-600">
                      {t('born')}: {formatDateForDisplay(dependent.dateOfBirth)} | 
                      {t('gender')}: {dependent.gender} | 
                      {t('relationship')}: {dependent.relationship || t('not.specified')} | 
                      {t('baptized')}: {dependent.isBaptized ? t('yes') : t('no')}
                    </p>
                    {dependent.baptismName && (
                      <p className="text-sm text-gray-600">
                        {t('baptism.name')}: {dependent.baptismName}
                      </p>
                    )}
                    
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDependent(index)}
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

            {dependents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{t('no.dependents.added')}</p>
          <p className="text-sm mt-2">{t('add.dependents.now')}</p>
        </div>
      )}
     </div>
   );
 };

export {
  PersonalInfoStep,
  ContactAddressStep,
  FamilyInfoStep,
  DependentsStep,
  SpiritualInfoStep,
  ContributionStep,
  AccountStep
}; 