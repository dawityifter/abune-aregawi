import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions } from '../../utils/roles';
import EmployeeFormModal from './EmployeeFormModal';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  position?: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'volunteer';
  email?: string;
  phone_number?: string;
  salary_amount?: number;
  salary_frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'annual' | 'per-service';
  hire_date?: string;
  termination_date?: string;
  is_active: boolean;
  created_at: string;
}

const EmployeeList: React.FC = () => {
  const { firebaseUser, currentUser, getUserProfile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          const uid = currentUser.uid || currentUser.id;
          const email = currentUser.email;
          const phone = currentUser.phoneNumber;
          if (uid) {
            const profile = await getUserProfile(uid, email, phone);
            setUserProfile(profile);
            const userRole = profile?.data?.member?.role || currentUser?.role || 'member';
            const permissions = getRolePermissions(userRole);
            setCanEdit(permissions.canManageRoles || userRole === 'admin');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [currentUser, getUserProfile]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await firebaseUser?.getIdToken();
      
      const params = new URLSearchParams();
      if (employmentTypeFilter) params.append('employment_type', employmentTypeFilter);
      if (statusFilter) params.append('is_active', statusFilter);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/employees?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.data || []);
      } else {
        setError('Failed to load employees');
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!window.confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/employees/${employee.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        fetchEmployees();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete employee');
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
      alert('An error occurred while deleting the employee');
    }
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowFormModal(true);
  };

  const handleAdd = () => {
    setSelectedEmployee(null);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    fetchEmployees();
    setShowFormModal(false);
    setSelectedEmployee(null);
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        employee.first_name?.toLowerCase().includes(searchLower) ||
        employee.last_name?.toLowerCase().includes(searchLower) ||
        employee.email?.toLowerCase().includes(searchLower) ||
        employee.position?.toLowerCase().includes(searchLower);
      
      const matchesEmploymentType = !employmentTypeFilter || employee.employment_type === employmentTypeFilter;
      const matchesStatus = !statusFilter || employee.is_active.toString() === statusFilter;
      
      return matchesSearch && matchesEmploymentType && matchesStatus;
    });
  }, [employees, searchTerm, employmentTypeFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Employee Management</h2>
          <p className="text-gray-600 mt-1">Manage church employees and staff</p>
        </div>
        {canEdit && (
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-plus mr-2"></i>
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or position..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employment Type
            </label>
            <select
              value={employmentTypeFilter}
              onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Employee List */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No employees found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employment Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.first_name} {employee.last_name}
                    </div>
                    {employee.email && (
                      <div className="text-sm text-gray-500">{employee.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.position || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {employee.employment_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.salary_amount ? (
                      <>
                        ${employee.salary_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {employee.salary_frequency && (
                          <span className="text-gray-500"> / {employee.salary_frequency}</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      employee.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {employee.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {canEdit && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <EmployeeFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setSelectedEmployee(null);
          }}
          onSuccess={handleFormSuccess}
          employee={selectedEmployee}
        />
      )}
    </div>
  );
};

export default EmployeeList;



