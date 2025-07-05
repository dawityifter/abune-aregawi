import React from 'react';

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
          <option value="Prefer not to say">Prefer not to say</option>
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
    <h3 className="text-xl font-semibold text-gray-800">{t.contactInfo}</h3>
    
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
          placeholder="+1 (555) 123-4567"
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
          value={formData.streetAddress}
          onChange={(e) => handleInputChange('streetAddress', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.streetAddress ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.streetAddress && <p className="text-red-500 text-sm mt-1">{errors.streetAddress}</p>}
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
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isHeadOfHousehold"
          checked={formData.isHeadOfHousehold}
          onChange={(e) => handleInputChange('isHeadOfHousehold', e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="isHeadOfHousehold" className="ml-2 text-sm text-gray-700">
          Head of Household
        </label>
      </div>
      
      {formData.maritalStatus === 'Married' && (
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
      )}
      
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
            onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>
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
          Date Joined Parish
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
          Name Day / Patron Saint
        </label>
        <input
          type="text"
          value={formData.nameDay}
          onChange={(e) => handleInputChange('nameDay', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="e.g., St. John, St. Mary"
        />
      </div>
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isBaptized"
          checked={formData.isBaptized}
          onChange={(e) => handleInputChange('isBaptized', e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="isBaptized" className="ml-2 text-sm text-gray-700">
          Baptized
        </label>
      </div>
      
      {formData.isBaptized && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Baptism
          </label>
          <input
            type="date"
            value={formData.baptismDate}
            onChange={(e) => handleInputChange('baptismDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isChrismated"
          checked={formData.isChrismated}
          onChange={(e) => handleInputChange('isChrismated', e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="isChrismated" className="ml-2 text-sm text-gray-700">
          Chrismated
        </label>
      </div>
      
      {formData.isChrismated && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Chrismation
          </label>
          <input
            type="date"
            value={formData.chrismationDate}
            onChange={(e) => handleInputChange('chrismationDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isCommunicantMember"
          checked={formData.isCommunicantMember}
          onChange={(e) => handleInputChange('isCommunicantMember', e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="isCommunicantMember" className="ml-2 text-sm text-gray-700">
          Communicant Member
        </label>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Spiritual Father
        </label>
        <input
          type="text"
          value={formData.spiritualFather}
          onChange={(e) => handleInputChange('spiritualFather', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="e.g., Fr. Michael"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Liturgical Role
        </label>
        <select
          value={formData.liturgicalRole}
          onChange={(e) => handleInputChange('liturgicalRole', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="None">None</option>
          <option value="Deacon">Deacon</option>
          <option value="Subdeacon">Subdeacon</option>
          <option value="Reader">Reader</option>
          <option value="Choir">Choir</option>
          <option value="Altar Server">Altar Server</option>
          <option value="Sisterhood">Sisterhood</option>
          <option value="Brotherhood">Brotherhood</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Language Preference
        </label>
        <select
          value={formData.languagePreference}
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