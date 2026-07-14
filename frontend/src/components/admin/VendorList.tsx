import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getRolePermissions } from '../../utils/roles';
import VendorFormModal from './VendorFormModal';

interface Vendor {
  id: string;
  name: string;
  vendor_type: 'utility' | 'supplier' | 'service-provider' | 'contractor' | 'lender' | 'other';
  contact_person?: string;
  email?: string;
  phone_number?: string;
  account_number?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: string;
}

const VendorList: React.FC = () => {
  const { firebaseUser, currentUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
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

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await firebaseUser?.getIdToken();
      
      const params = new URLSearchParams();
      if (vendorTypeFilter) params.append('vendor_type', vendorTypeFilter);
      if (statusFilter) params.append('is_active', statusFilter);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/vendors?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVendors(data.data || []);
      } else {
        setError(t('vendorList.loadFailed'));
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, vendorTypeFilter, statusFilter]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleDelete = async (vendor: Vendor) => {
    if (!window.confirm(t('vendorList.confirmDelete', { name: vendor.name }))) {
      return;
    }

    try {
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/vendors/${vendor.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        fetchVendors();
      } else {
        const data = await response.json();
        alert(data.message || t('vendorList.deleteFailed'));
      }
    } catch (err) {
      console.error('Error deleting vendor:', err);
      alert(t('vendorList.deleteError'));
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowFormModal(true);
  };

  const handleAdd = () => {
    setSelectedVendor(null);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    fetchVendors();
    setShowFormModal(false);
    setSelectedVendor(null);
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter(vendor => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        vendor.name?.toLowerCase().includes(searchLower) ||
        vendor.contact_person?.toLowerCase().includes(searchLower) ||
        vendor.email?.toLowerCase().includes(searchLower) ||
        vendor.account_number?.toLowerCase().includes(searchLower);
      
      const matchesVendorType = !vendorTypeFilter || vendor.vendor_type === vendorTypeFilter;
      const matchesStatus = !statusFilter || vendor.is_active.toString() === statusFilter;
      
      return matchesSearch && matchesVendorType && matchesStatus;
    });
  }, [vendors, searchTerm, vendorTypeFilter, statusFilter]);

  const vendorTypeLabels: Record<string, string> = {
    utility: t('vendorList.typeUtility'),
    supplier: t('vendorList.typeSupplier'),
    'service-provider': t('vendorList.typeServiceProvider'),
    contractor: t('vendorList.typeContractor'),
    lender: t('vendorList.typeLender'),
    other: t('vendorList.typeOther')
  };

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
          <h2 className="text-2xl font-semibold text-gray-900">{t('vendorList.title')}</h2>
          <p className="text-gray-600 mt-1">{t('vendorList.subtitle')}</p>
        </div>
        {canEdit && (
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-plus mr-2"></i>
            {t('vendorList.add')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorList.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('vendorList.searchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorList.typeLabel')}
            </label>
            <select
              value={vendorTypeFilter}
              onChange={(e) => setVendorTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('vendorList.allTypes')}</option>
              <option value="utility">{t('vendorList.typeUtility')}</option>
              <option value="supplier">{t('vendorList.typeSupplier')}</option>
              <option value="service-provider">{t('vendorList.typeServiceProvider')}</option>
              <option value="contractor">{t('vendorList.typeContractor')}</option>
              <option value="lender">{t('vendorList.typeLender')}</option>
              <option value="other">{t('vendorList.typeOther')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('vendorList.statusLabel')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('vendorList.allStatus')}</option>
              <option value="true">{t('vendorList.statusActive')}</option>
              <option value="false">{t('vendorList.statusInactive')}</option>
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

      {/* Vendor List */}
      {filteredVendors.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">{t('vendorList.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colType')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colContact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colAccount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colTerms')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colStatus')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('vendorList.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                    {vendor.email && (
                      <div className="text-sm text-gray-500">{vendor.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                      {vendorTypeLabels[vendor.vendor_type] || vendor.vendor_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.contact_person || '—'}</div>
                    {vendor.phone_number && (
                      <div className="text-sm text-gray-500">{vendor.phone_number}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {vendor.account_number || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {vendor.payment_terms || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      vendor.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {vendor.is_active ? t('vendorList.statusActive') : t('vendorList.statusInactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {canEdit && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('vendorList.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(vendor)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('vendorList.delete')}
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
        <VendorFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setSelectedVendor(null);
          }}
          onSuccess={handleFormSuccess}
          vendor={selectedVendor}
        />
      )}
    </div>
  );
};

export default VendorList;


