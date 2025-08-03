import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatPhoneNumber } from '../utils/formatPhoneNumber';
import { formatDateForDisplay } from '../utils/dateUtils';

interface Dependant {
  id?: string;
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

const DependantsManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [dependants, setDependants] = useState<Dependant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingDependant, setEditingDependant] = useState<Dependant | null>(null);
  const [formData, setFormData] = useState<Dependant>({
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

  const fetchDependants = useCallback(async () => {
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
        
        // Now fetch dependants using the member ID
        const dependantsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependants`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (dependantsResponse.ok) {
          const data = await dependantsResponse.json();
          setDependants(data.data.dependants || []);
        }
      }
    } catch (error) {
      console.error('Error fetching dependants:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchDependants();
    }
  }, [currentUser, fetchDependants]);

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
      
      const url = editingDependant 
        ? `${process.env.REACT_APP_API_URL}/api/members/dependants/${editingDependant.id}`
        : `${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependants`;
      
      const method = editingDependant ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchDependants();
        resetForm();
        setIsAdding(false);
        setEditingDependant(null);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving dependant:', error);
      alert('Error saving dependant information');
    }
  };

  const handleDelete = async (dependantId: string) => {
    if (!window.confirm('Are you sure you want to delete this dependant?')) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/dependants/${dependantId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchDependants();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting dependant:', error);
      alert('Error deleting dependant');
    }
  };

  const handleEdit = (dependant: Dependant) => {
    setEditingDependant(dependant);
    setFormData(dependant);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
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
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingDependant(null);
    resetForm();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading dependants...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dependants & Dependents</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add Dependant
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingDependant ? 'Edit Dependant' : 'Add New Dependant'}
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
                {editingDependant ? 'Update Dependant' : 'Add Dependant'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dependants List */}
      <div className="bg-white rounded-lg shadow-md">
        {dependants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No dependants added yet.</p>
            <p className="text-sm mt-2">Click "Add Dependant" to get started.</p>
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
                {dependants.map((dependant) => (
                  <tr key={dependant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {dependant.firstName} {dependant.middleName} {dependant.lastName}
                      </div>
                      {dependant.email && (
                        <div className="text-sm text-gray-500">{dependant.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateForDisplay(dependant.dateOfBirth)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependant.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependant.baptismName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        dependant.isBaptized 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {dependant.isBaptized ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(dependant)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => dependant.id && handleDelete(dependant.id)}
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

export default DependantsManagement; 