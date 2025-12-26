import React, { useState, useEffect } from 'react';
import BankUpload from '../finance/BankUpload';
import BankTransactionList from '../finance/BankTransactionList';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, getMergedPermissions, UserRole } from '../../utils/roles';
import TransactionList from './TransactionList';
import PaymentStats from './PaymentStats';
import PaymentReports from './PaymentReports';
import AddPaymentModal from './AddPaymentModal';
import AddExpenseModal from './AddExpenseModal';
import ExpenseList from './ExpenseList';
import WeeklyCollectionReport from './WeeklyCollectionReport';
import ZelleReview from './ZelleReview';
import MemberSearch from './MemberSearch';
import EmployeeList from './EmployeeList';
import VendorList from './VendorList';
import { useLanguage } from '../../contexts/LanguageContext';

interface PaymentStatsData {
  totalMembers: number;
  contributingMembers: number;
  upToDateMembers: number;
  behindMembers: number;
  totalAmountDue: number;
  totalMembershipCollected: number;
  otherPayments: number;
  totalCollected: number;
  totalExpenses: number;
  netIncome: number;
  collectionRate: number;
  outstandingAmount: number;
}

const TreasurerDashboard: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses' | 'reports' | 'zelle' | 'member-dues' | 'employees' | 'vendors' | 'bank'>('overview');
  const [stats, setStats] = useState<PaymentStatsData | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  console.log('🏦 TreasurerDashboard: Component loaded');
  console.log('🏦 Current user:', currentUser);
  console.log('🏦 Firebase user:', firebaseUser);

  // Check user permissions
  const memberData = userProfile?.data?.member || userProfile || currentUser;
  const userRoles: UserRole[] = memberData?.roles || [(memberData?.role || 'member') as UserRole];
  const permissions = getMergedPermissions(userRoles);

  // Check if user has financial permissions
  const hasFinancialAccess = permissions.canViewFinancialRecords || permissions.canEditFinancialRecords;

  useEffect(() => {
    const fetchUserProfile = async () => {
      setProfileLoading(true);
      if (currentUser) {
        try {
          console.log('🔍 TreasurerDashboard - currentUser:', currentUser);

          // Handle different user object structures
          const uid = currentUser.uid || currentUser.id;
          const email = currentUser.email;
          const phone = currentUser.phoneNumber;

          if (!uid) {
            console.error('❌ No UID found in currentUser:', currentUser);
            return;
          }

          const profile = await getUserProfile(uid, email, phone);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
      setProfileLoading(false);
    };

    fetchUserProfile();
  }, [currentUser, getUserProfile]);

  useEffect(() => {
    if (hasFinancialAccess) {
      fetchPaymentStats();
    }
  }, [hasFinancialAccess]);

  // Keep stats in sync when payments complete (Stripe or non-Stripe)
  useEffect(() => {
    const listener = () => fetchPaymentStats();
    window.addEventListener('payments:refresh' as any, listener);
    return () => window.removeEventListener('payments:refresh' as any, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPaymentStats = async () => {
    try {
      console.log('🔍 Fetching payment stats...');
      console.log('🔍 Current user:', currentUser);
      console.log('🔍 Firebase user:', firebaseUser);

      // Clear existing stats
      setStats(null);
      setLoading(true);

      // Fetch pledge/ledger-based stats
      const endpoint = '/api/payments/stats';

      console.log('🔍 Using endpoint:', endpoint);

      const response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Payment stats data:', data);
        setStats(data.data);
      } else {
        console.error('❌ Payment stats API error:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error data:', errorData);
      }
    } catch (error) {
      console.error('❌ Error fetching payment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if user has access to financial records
  if (!hasFinancialAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">
            <i className="fas fa-lock text-2xl mb-2"></i>
            <p>{t('treasurerDashboard.access.denied')}</p>
            <p className="text-sm text-gray-600 mt-2">
              {t('treasurerDashboard.access.deniedDesc')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('treasurerDashboard.title')}</h1>
          <p className="mt-2 text-gray-600">{t('treasurerDashboard.subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <div className="-mb-px flex items-center justify-between">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.overview')}
              </button>
              <button
                onClick={() => setActiveTab('bank')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'bank'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Bank Integration
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.payments')}
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'expenses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.expenses')}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.reports')}
              </button>
              <button
                onClick={() => setActiveTab('zelle')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'zelle'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.zelle')}
              </button>
              <button
                onClick={() => setActiveTab('member-dues')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'member-dues'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.memberDues')}
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.employees')}
              </button>
              <button
                onClick={() => setActiveTab('vendors')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'vendors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {t('treasurerDashboard.tabs.vendors')}
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.overview.title')}</h2>
                <div className="flex space-x-3">
                  {permissions.canEditFinancialRecords && (
                    <button
                      onClick={() => setShowAddPaymentModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                    >
                      {t('treasurerDashboard.actions.addPayment')}
                    </button>
                  )}
                  {permissions.canAddExpenses && (
                    <button
                      onClick={() => setShowAddExpenseModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
                    >
                      {t('treasurerDashboard.actions.addExpense')}
                    </button>
                  )}
                </div>
              </div>
              {stats && <PaymentStats stats={stats} />}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.tabs.payments')}</h2>
                {permissions.canEditFinancialRecords && (
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {t('treasurerDashboard.actions.addPayment')}
                  </button>
                )}
              </div>
              <TransactionList
                onTransactionAdded={fetchPaymentStats}
              />
            </div>
          )}

          {activeTab === 'expenses' && permissions.canViewExpenses && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.tabs.expenses')}</h2>
                {permissions.canAddExpenses && (
                  <button
                    onClick={() => setShowAddExpenseModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    {t('treasurerDashboard.actions.addExpense')}
                  </button>
                )}
              </div>
              <ExpenseList />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">{t('treasurerDashboard.reports.weeklyCollection')}</h2>
                <WeeklyCollectionReport />
              </div>

              <div className="border-t pt-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">{t('treasurerDashboard.reports.paymentReports')}</h2>
                <PaymentReports paymentView="new" />
              </div>
            </div>
          )}

          {activeTab === 'zelle' && (
            <div>
              <ZelleReview />
            </div>
          )}

          {activeTab === 'member-dues' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.memberDues.title')}</h2>
                  <p className="text-gray-600 mt-1">{t('treasurerDashboard.memberDues.subtitle')}</p>
                </div>
                <button
                  onClick={() => setShowMemberSearch(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {t('treasurerDashboard.actions.searchMember')}
                </button>
              </div>
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('treasurerDashboard.memberDues.searchTitle')}</h3>
                <p className="text-gray-600 mb-4">
                  {t('treasurerDashboard.memberDues.searchDesc')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('treasurerDashboard.memberDues.searchNote')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Bank Reconciliation</h2>
                  <p className="text-gray-600 mt-1">Upload Chase CSVs and match transactions to members.</p>
                </div>
              </div>
              <BankUpload onUploadSuccess={() => window.dispatchEvent(new CustomEvent('bank:refresh'))} />
              <div className="mt-8">
                <BankTransactionList refreshTrigger={0} />
              </div>
            </div>
          )}

          {activeTab === 'employees' && (
            <div>
              <EmployeeList />
            </div>
          )}

          {activeTab === 'vendors' && (
            <div>
              <VendorList />
            </div>
          )}
        </div>

        {/* Member Search Modal */}
        {showMemberSearch && (
          <MemberSearch
            onMemberSelect={(memberId) => {
              // The MemberSearch component handles showing the MemberDuesViewer
              console.log('Selected member:', memberId);
            }}
            onClose={() => setShowMemberSearch(false)}
          />
        )}

        {/* Add Payment Modal */}
        {showAddPaymentModal && (
          <AddPaymentModal
            onClose={() => setShowAddPaymentModal(false)}
            onPaymentAdded={() => {
              setShowAddPaymentModal(false);
              fetchPaymentStats();
            }}
            paymentView="new"
          />
        )}

        {/* Add Expense Modal */}
        {showAddExpenseModal && (
          <AddExpenseModal
            isOpen={showAddExpenseModal}
            onClose={() => setShowAddExpenseModal(false)}
            onSuccess={() => {
              setShowAddExpenseModal(false);
              fetchPaymentStats();
              // Trigger refresh for expense list if on that tab
              window.dispatchEvent(new CustomEvent('expenses:refresh'));
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TreasurerDashboard; 