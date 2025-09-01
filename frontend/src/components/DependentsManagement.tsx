import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatPhoneNumber } from '../utils/formatPhoneNumber';
import { formatDateForDisplay } from '../utils/dateUtils';
import { Dependent, getRelationshipOptions, Relationship } from '../utils/relationshipTypes';



const DependentsManagement: React.FC = () => {
  const { currentUser, getUserProfile } = useAuth();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [formData, setFormData] = useState<Dependent>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    relationship: undefined,
    phone: '',
    email: '',
    baptismName: '',
    isBaptized: false,
    medicalConditions: '',
    allergies: '',
    medications: '',
    dietaryRestrictions: '',
    notes: ''
  });

  const fetchDependents = useCallback(async () => {
    try {
      // First get the member profile (handles members and dependent logins)
      if (!currentUser?.uid) return;
      const profile = await getUserProfile(currentUser.uid, currentUser.email || null, currentUser.phoneNumber || null);
      if (!profile || !profile.data?.member) return;

      const profileMember = profile.data.member;
      const memberId = profileMember.role === 'dependent' ? profileMember.linkedMember?.id : profileMember.id;
      if (!memberId) return;

      // Now fetch dependents using the resolved member ID (head of household)
      const dependentsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (dependentsResponse.ok) {
        const data = await dependentsResponse.json();
        setDependents(data.data.dependents || []);
      }
    } catch (error) {
      console.error('Error fetching dependents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchDependents();
    }
  }, [currentUser, fetchDependents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get the member (or linked member for dependent) ID first
      if (!currentUser?.uid) throw new Error('Not authenticated');
      const profile = await getUserProfile(currentUser.uid, currentUser.email || null, currentUser.phoneNumber || null);
      if (!profile || !profile.data?.member) throw new Error('Failed to get member profile');

      const profileMember = profile.data.member;
      const memberId = profileMember.role === 'dependent' ? profileMember.linkedMember?.id : profileMember.id;
      if (!memberId) throw new Error('Could not resolve member ID');
      
      const url = editingDependent 
        ? `${process.env.REACT_APP_API_URL}/api/members/dependents/${editingDependent.id}`
        : `${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`;
      
      const method = editingDependent ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchDependents();
        resetForm();
        setIsAdding(false);
        setEditingDependent(null);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving dependent:', error);
      alert('Error saving dependent information');
    }
  };

  const handleDelete = async (dependentId: string) => {
    if (!window.confirm('Are you sure you want to delete this dependent?')) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/dependents/${dependentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchDependents();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting dependent:', error);
      alert('Error deleting dependent');
    }
  };

  const handleEdit = (dependent: Dependent) => {
    setEditingDependent(dependent);
    setFormData(dependent);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      relationship: undefined,
      phone: '',
      email: '',
      baptismName: '',
      isBaptized: false,
      medicalConditions: '',
      allergies: '',
      medications: '',
      dietaryRestrictions: '',
      notes: ''
    });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingDependent(null);
    resetForm();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading dependents...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Spouse & Dependents</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add Dependent
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingDependent ? 'Edit Dependent' : 'Add New Dependent'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middleName || ''}
                  onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <select
                  required
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value as 'Male' | 'Female'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <select
                  value={formData.relationship || ''}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value as Relationship || undefined})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Relationship</option>
                  {getRelationshipOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Baptism Name
                </label>
                <input
                  type="text"
                  value={formData.baptismName || ''}
                  onChange={(e) => setFormData({...formData, baptismName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              

              

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isBaptized"
                  checked={formData.isBaptized}
                  onChange={(e) => setFormData({...formData, isBaptized: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isBaptized" className="ml-2 block text-sm text-gray-900">
                  Is Baptized
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingDependent ? 'Update Dependent' : 'Add Dependent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dependents List */}
      <div className="bg-white rounded-lg shadow-md">
        {dependents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No dependents added yet.</p>
            <p className="text-sm mt-2">Click "Add Dependent" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date of Birth
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Relationship
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Baptism Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Baptized
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dependents.map((dependent) => (
                  <tr key={dependent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {dependent.firstName} {dependent.middleName} {dependent.lastName}
                      </div>
                      {dependent.email && (
                        <div className="text-sm text-gray-500">{dependent.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.dateOfBirth ? formatDateForDisplay(dependent.dateOfBirth) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.relationship || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.baptismName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        dependent.isBaptized 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {dependent.isBaptized ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(dependent)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => dependent.id && handleDelete(dependent.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DependentsManagement; 