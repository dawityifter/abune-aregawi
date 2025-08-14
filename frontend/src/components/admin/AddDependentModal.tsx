import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface AddDependentModalProps {
  memberId: string | number;
  memberName?: string;
  onClose: () => void;
  onCreated: () => void;
}

const RELATIONSHIP_VALUES = ['Son','Daughter','Spouse','Parent','Sibling','Other'] as const;

type Relationship = typeof RELATIONSHIP_VALUES[number];

const AddDependentModal: React.FC<AddDependentModalProps> = ({ memberId, memberName, onClose, onCreated }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    relationship: '' as '' | Relationship,
    email: '',
    phone: '',
    baptismName: '',
    isBaptized: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const relationshipOptions = useMemo(() => RELATIONSHIP_VALUES, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.firstName || !form.lastName) {
      setError('First name and last name are required');
      return;
    }

    setLoading(true);
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;
      const payload: any = {
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        relationship: form.relationship || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        baptismName: form.baptismName || undefined,
        isBaptized: !!form.isBaptized,
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`, {
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
        throw new Error(data.message || 'Failed to add dependent');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add dependent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">{t('add.dependent') || 'Add Dependent'}{memberName ? ` - ${memberName}` : ''}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
              <select name="relationship" value={form.relationship} onChange={handleChange} className="w-full px-3 py-2 border rounded">
                <option value="">--</option>
                {relationshipOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baptism Name</label>
              <input name="baptismName" value={form.baptismName} onChange={handleChange} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input id="isBaptized" type="checkbox" name="isBaptized" checked={form.isBaptized} onChange={handleChange} />
            <label htmlFor="isBaptized" className="text-sm text-gray-700">Is Baptized</label>
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

export default AddDependentModal;
