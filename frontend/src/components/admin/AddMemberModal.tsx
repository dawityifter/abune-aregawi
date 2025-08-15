import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatPhoneNumber, normalizePhoneNumber, isValidPhoneNumber } from '../../utils/formatPhoneNumber';

interface AddMemberModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ onClose, onCreated }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    gender: '',
    streetLine1: '',
    apartmentNo: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
    baptismName: '',
    repentanceFather: '',
    interestedInServing: 'maybe',
    yearlyPledge: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneCheckLoading, setPhoneCheckLoading] = useState(false);
  const [phoneDuplicateMsg, setPhoneDuplicateMsg] = useState<string | null>(null);

  const isCreateDisabled = loading || phoneCheckLoading || !!phoneDuplicateMsg;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      const formatted = formatPhoneNumber(value);
      // Clear duplicate state while user edits; will re-check on blur
      if (phoneDuplicateMsg) setPhoneDuplicateMsg(null);
      if (phoneCheckLoading) setPhoneCheckLoading(false);
      setForm(prev => ({ ...prev, [name]: formatted }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const normalizePhone = (v: string) => {
    if (!v) return v;
    const trimmed = v.trim();
    if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/[^\d]/g, '');
    return trimmed.replace(/[^\d]/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Required based on DB: first_name, last_name, phone_number
    if (!form.firstName || !form.lastName || !form.phoneNumber) {
      setError('First name, last name, and phone number are required');
      return;
    }
    if (!isValidPhoneNumber(form.phoneNumber)) {
      setError('Please enter a valid phone number');
      return;
    }
    if (phoneDuplicateMsg) {
      setError(phoneDuplicateMsg);
      return;
    }

    setLoading(true);
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;

      const payload: any = {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        phoneNumber: normalizePhoneNumber(form.phoneNumber),
        email: form.email || undefined,
        gender: form.gender ? form.gender.toLowerCase() : undefined,
        streetLine1: form.streetLine1 || undefined,
        apartmentNo: form.apartmentNo || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        baptismName: form.baptismName || undefined,
        repentanceFather: form.repentanceFather || undefined,
        interestedInServing: form.interestedInServing ? String(form.interestedInServing).toLowerCase() : undefined,
        yearlyPledge: form.yearlyPledge ? Number(form.yearlyPledge) : undefined,
        // Admin-created members should default to head of household to bypass HoH phone requirement
        isHeadOfHousehold: true,
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create member');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">{t('add.member') || 'Add Member'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          This will create a <span className="font-medium">Head of Household</span>. To add a non-head member, use <span className="font-medium">Add Dependent</span> from the member list.
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone first */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                onBlur={async () => {
                  setPhoneDuplicateMsg(null);
                  if (!form.phoneNumber || !isValidPhoneNumber(form.phoneNumber)) return;
                  try {
                    setPhoneCheckLoading(true);
                    const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;
                    const normalized = normalizePhoneNumber(form.phoneNumber);
                    const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/check-phone/${encodeURIComponent(normalized)}`, {
                      headers: {
                        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                      },
                    });
                    const data = await resp.json().catch(() => ({}));
                    if (resp.ok && data?.data?.exists) {
                      const { firstName, lastName } = data.data;
                      setPhoneDuplicateMsg(`A member with this phone already exists: ${firstName} ${lastName}`);
                    } else {
                      setPhoneDuplicateMsg(null);
                    }
                  } catch (e) {
                    // Non-blocking: fail open
                    setPhoneDuplicateMsg(null);
                  } finally {
                    setPhoneCheckLoading(false);
                  }
                }}
                inputMode="tel"
                placeholder="(555) 555-1234"
                className={`w-full px-3 py-2 border rounded ${phoneDuplicateMsg ? 'border-red-500' : ''}`}
              />
              <div className="mt-1 text-xs">
                {phoneCheckLoading && <span className="text-gray-500">Checking phone…</span>}
                {!phoneCheckLoading && phoneDuplicateMsg && (
                  <span className="text-red-600">{phoneDuplicateMsg}</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2"></div>
          </div>

          {/* Names and basic info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input name="middleName" value={form.middleName} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="">--</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Spiritual and contribution info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baptism Name</label>
              <input name="baptismName" value={form.baptismName} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repentance Father</label>
              <select
                name="repentanceFather"
                value={form.repentanceFather}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Select --</option>
                <option value="H.G Abune Kerlos">H.G Abune Kerlos</option>
                <option value="M.T Kesis Tadesse">M.T Kesis Tadesse</option>
                <option value="M.M Kesis Seifu">M.M Kesis Seifu</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interested in Serving</label>
              <select name="interestedInServing" value={form.interestedInServing} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="maybe">Maybe</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Pledge</label>
              {(() => {
                const amountPattern = /^[0-9]*([.][0-9]{0,2})?$/;
                const onChange = (v: string) => {
                  if (v === '' || amountPattern.test(v)) {
                    setForm(prev => ({ ...prev, yearlyPledge: v }));
                  }
                };
                const onBlur = () => {
                  const v = form.yearlyPledge;
                  if (v === undefined || v === null || v === '') return;
                  const num = Number(v);
                  if (Number.isFinite(num)) {
                    setForm(prev => ({ ...prev, yearlyPledge: num.toFixed(2) }));
                  }
                };
                return (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.yearlyPledge || ''}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="e.g. 1200"
                    name="yearlyPledge"
                  />
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
              <input name="streetLine1" value={form.streetLine1} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apt</label>
              <input name="apartmentNo" value={form.apartmentNo} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input name="city" value={form.city} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input name="state" value={form.state} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input name="postalCode" value={form.postalCode} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input name="country" value={form.country} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">{t('cancel')}</button>
            <button
              type="submit"
              disabled={isCreateDisabled}
              title={phoneDuplicateMsg ? 'Phone already exists. Please enter a different number.' : undefined}
              className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50"
            >
              {loading ? (t('saving') || 'Saving...') : (t('create') || 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal;
