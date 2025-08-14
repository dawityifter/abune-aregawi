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
    dateOfBirth: '',
    gender: '',
    streetLine1: '',
    apartmentNo: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
    role: 'member',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      setForm(prev => ({ ...prev, [name]: formatPhoneNumber(value) }));
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

    setLoading(true);
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;

      const payload: any = {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        phoneNumber: normalizePhoneNumber(form.phoneNumber),
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender ? form.gender.toLowerCase() : undefined,
        streetLine1: form.streetLine1 || undefined,
        apartmentNo: form.apartmentNo || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        role: form.role || 'member',
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

        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
                inputMode="tel"
                placeholder="(555) 555-1234"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select name="role" value={form.role} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="member">Member</option>
                <option value="guest">Guest</option>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
                <option value="church_leadership">Church Leadership</option>
                <option value="admin">Admin</option>
                <option value="deacon">Deacon</option>
                <option value="priest">Priest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
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
            <button type="submit" disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50">
              {loading ? (t('saving') || 'Saving...') : (t('create') || 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal;
