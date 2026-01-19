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

  const getSmartIcon = (dept: Department) => {
    const name = dept.name.toLowerCase();
    const type = dept.type.toLowerCase();

    // Specific name-based icons
    if (name.includes('choir') || name.includes('music') || name.includes('song') || name.includes('yamare')) return 'fas fa-music';
    if (name.includes('sunday') || name.includes('school') || name.includes('timhirti')) return 'fas fa-graduation-cap';
    if (name.includes('finance') || name.includes('treasur') || name.includes('money')) return 'fas fa-coins';
    if (name.includes('social') || name.includes('event')) return 'fas fa-glass-cheers';
    if (name.includes('building') || name.includes('maint')) return 'fas fa-tools';
    if (name.includes('outreach') || name.includes('mission')) return 'fas fa-hands-helping';
    if (name.includes('youth') || name.includes('young')) return 'fas fa-child';
    if (name.includes('women') || name.includes('mother')) return 'fas fa-female';
    if (name.includes('kitchen') || name.includes('food')) return 'fas fa-utensils';
    if (name.includes('audit')) return 'fas fa-file-invoice';
    if (name.includes('it ') || name.includes('tech') || name.includes('media')) return 'fas fa-laptop-code';
    if (name.includes('pr ') || name.includes('relation')) return 'fas fa-bullhorn';
    if (name.includes('board') || name.includes('admin')) return 'fas fa-user-tie';

    // Type fallback
    switch (type) {
      case 'ministry': return 'fas fa-church';
      case 'committee': return 'fas fa-users-cog';
      case 'service': return 'fas fa-hand-holding-heart';
      case 'social': return 'fas fa-users';
      case 'administrative': return 'fas fa-cogs';
      default: return 'fas fa-folder';
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'ministry': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'committee': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'service': return 'bg-green-50 text-green-700 border-green-100';
      case 'social': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'administrative': return 'bg-gray-50 text-gray-700 border-gray-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
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
    <div className="space-y-8">
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
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm"
        >
          <i className="fas fa-plus mr-2"></i>
          {t('admin.departmentSection.create')}
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-primary-100 flex items-center justify-between">
            <div>
              <p className="text-primary-600 text-sm font-semibold uppercase tracking-wider mb-1">
                {t('admin.departmentSection.stats.total')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {departments.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
              <i className="fas fa-building text-2xl"></i>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-semibold uppercase tracking-wider mb-1">
                {t('admin.departmentSection.stats.enrolled')}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {departments.reduce((acc, dep) => acc + (dep.member_count || 0), 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
              <i className="fas fa-users text-2xl"></i>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-semibold uppercase tracking-wider mb-1">
                {t('admin.departmentSection.stats.byType')}
              </p>
              <div className="text-sm font-medium text-gray-600 mt-1 flex flex-wrap gap-2">
                {Object.entries(
                  departments.reduce((acc, dep) => {
                    acc[dep.type] = (acc[dep.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <span key={type} className="inline-flex items-center bg-gray-50 px-2 py-1 rounded">
                    <span className="w-2 h-2 rounded-full bg-purple-400 mr-2"></span>
                    {t(`admin.departmentSection.types.${type}`) || type}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <i className="fas fa-layer-group text-2xl"></i>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('admin.common.search') + '...'}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-filter text-gray-400"></i>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition duration-150 ease-in-out appearance-none form-select"
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
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
            <i className="fas fa-building text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 text-lg font-medium">
            {t('no.departments.found') || 'No departments found matching your criteria'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold"
          >
            <i className="fas fa-plus-circle mr-2"></i>
            {t('create.your.first.department') || 'Create New Department'}
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(departmentsByType).map(([type, depts]) => (
            <div key={type} className="space-y-5">
              <div className={`flex items-center space-x-3 pb-2 border-b-2 ${getSectionColor(type).split(' ')[2] || 'border-gray-100'}`}>
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 text-xl`}>
                  <i className={getSmartIcon({ name: '', type } as any)}></i>
                </span>
                <h3 className="text-xl font-bold text-gray-800 capitalize tracking-tight">
                  {type.replace('_', ' ')}
                  <span className="ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {depts.length}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {depts.map((dept) => (
                  <DepartmentCard
                    key={dept.id}
                    department={dept}
                    onUpdate={handleDepartmentUpdated}
                    getTypeColor={getTypeColor}
                    icon={getSmartIcon(dept)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Department Modal - Kept same logic */}
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
