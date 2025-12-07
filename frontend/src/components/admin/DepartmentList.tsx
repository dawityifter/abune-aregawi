import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import CreateDepartmentModal from './CreateDepartmentModal';
import DepartmentCard from './DepartmentCard';

interface Department {
  id: number;
  name: string;
  description: string;
  type: string;
  leader_id: number | null;
  meeting_schedule: string;
  is_active: boolean;
  is_public: boolean;
  max_members: number | null;
  member_count: number;
  leader?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  subDepartments?: Department[];
}

const DepartmentList: React.FC = () => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchDepartments();
    fetchStats();
  }, [typeFilter]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('User not authenticated');
      }

      const idToken = await firebaseUser.getIdToken();

      const params = new URLSearchParams({
        include_members: 'true',
        limit: '100'
      });

      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch departments');
      }

      const data = await response.json();
      setDepartments(data.data.departments || []);
    } catch (error: any) {
      setError(error.message);
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!firebaseUser) return;

      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/stats`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDepartmentCreated = () => {
    setShowCreateModal(false);
    fetchDepartments();
    fetchStats();
  };

  const handleDepartmentUpdated = () => {
    fetchDepartments();
    fetchStats();
  };

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = !searchTerm ||
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const departmentsByType = filteredDepartments.reduce((acc, dept) => {
    if (!acc[dept.type]) {
      acc[dept.type] = [];
    }
    acc[dept.type].push(dept);
    return acc;
  }, {} as Record<string, Department[]>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ministry': return '🙏';
      case 'committee': return '💼';
      case 'service': return '🎵';
      case 'social': return '🤝';
      case 'administrative': return '⚙️';
      default: return '📋';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ministry': return 'bg-purple-100 text-purple-800';
      case 'committee': return 'bg-blue-100 text-blue-800';
      case 'service': return 'bg-green-100 text-green-800';
      case 'social': return 'bg-yellow-100 text-yellow-800';
      case 'administrative': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg mb-4">{error}</div>
        <button
          onClick={fetchDepartments}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t('admin.departmentSection.title')}
          </h2>
          <p className="text-gray-600 mt-1">
            {t('admin.departmentSection.description')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <i className="fas fa-plus mr-2"></i>
          {t('admin.departmentSection.create')}
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-primary-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-600 text-sm font-medium uppercase tracking-wide">
                  {t('admin.departmentSection.stats.total')}
                </p>
                <p className="text-3xl font-bold text-primary-900 mt-1">
                  {departments.length}
                </p>
              </div>
              <div className="text-primary-200">
                <i className="fas fa-building text-4xl"></i>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium uppercase tracking-wide">
                  {t('admin.departmentSection.stats.enrolled')}
                </p>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {departments.reduce((acc, dep) => acc + (dep.member_count || 0), 0)}
                </p>
              </div>
              <div className="text-green-200">
                <i className="fas fa-users text-4xl"></i>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium uppercase tracking-wide">
                  {t('admin.departmentSection.stats.byType')}
                </p>
                <p className="text-sm font-medium text-purple-900 mt-1">
                  {/* Simple breakdown by type */}
                  {Object.entries(
                    departments.reduce((acc, dep) => {
                      acc[dep.type] = (acc[dep.type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([type, count]) => (
                    <span key={type} className="mr-2">
                      {t(`admin.departmentSection.types.${type}`) || type}: {count}
                    </span>
                  ))}
                </p>
              </div>
              <div className="text-purple-200">
                <i className="fas fa-layer-group text-4xl"></i>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.common.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('admin.common.search') + '...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.common.filter')}</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('admin.common.all')}</option>
              <option value="ministry">{t('admin.departmentSection.types.ministry')}</option>
              <option value="committee">{t('admin.departmentSection.types.committee')}</option>
              <option value="service">{t('admin.departmentSection.types.service')}</option>
              <option value="social">{t('admin.departmentSection.types.social')}</option>
              <option value="administrative">{t('admin.departmentSection.types.administrative')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Department List by Type */}
      {Object.keys(departmentsByType).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <i className="fas fa-building text-6xl text-gray-300 mb-4"></i>
          <p className="text-gray-500 text-lg">
            {t('no.departments.found') || 'No departments found'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            {t('create.your.first.department') || 'Create your first department'}
          </button>
        </div>
      ) : (
        Object.entries(departmentsByType).map(([type, depts]) => (
          <div key={type} className="space-y-4">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getTypeIcon(type)}</span>
              <h3 className="text-xl font-semibold text-gray-900 capitalize">
                {type.replace('_', ' ')} ({depts.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {depts.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  onUpdate={handleDepartmentUpdated}
                  getTypeColor={getTypeColor}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Create Department Modal */}
      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleDepartmentCreated}
        />
      )}
    </div>
  );
};

export default DepartmentList;
