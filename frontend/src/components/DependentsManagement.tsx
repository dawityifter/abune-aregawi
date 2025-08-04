import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateForDisplay } from '../utils/dateUtils';

interface Dependent {
  id?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  relationship?: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
}

const DependentsManagement: React.FC = () => {
  const { currentUser } = useAuth();
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
    relationship: '',
    medicalConditions: '',
    allergies: '',
    medications: '',
    dietaryRestrictions: '',
    notes: ''
  });

  const fetchDependents = useCallback(async () => {
    try {
      // First get the member profile to get the member ID
      // Build query parameters based on available user data
      const params = new URLSearchParams();
      if (currentUser?.email) {
        params.append('email', currentUser.email);
      }
      if (currentUser?.phoneNumber) {
        params.append('phone', currentUser.phoneNumber);
      }
      
      const profileResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser?.uid}?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const memberId = profileData.data.member.id;
        
        // Now fetch dependents using the member ID
        const dependentsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (dependentsResponse.ok) {
          const data = await dependentsResponse.json();
          setDependents(data.data.dependents || []);
        }
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
      // Get member ID first
      // Build query parameters based on available user data
      const params = new URLSearchParams();
      if (currentUser?.email) {
        params.append('email', currentUser.email);
      }
      if (currentUser?.phoneNumber) {
        params.append('phone', currentUser.phoneNumber);
      }
      
      const profileResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser?.uid}?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!profileResponse.ok) {
        throw new Error('Failed to get member profile');
      }
      
      const profileData = await profileResponse.json();
      const memberId = profileData.data.member.id;
      
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
      relationship: '',
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
                  Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={formData.dateOfBirth}
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
                <input
                  type="text"
                  value={formData.relationship || ''}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={formData.relationship || ''}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                      {formatDateForDisplay(dependent.dateOfBirth)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.relationship || '-'}
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