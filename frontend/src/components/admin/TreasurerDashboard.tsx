import React, { useState, useEffect, useCallback } from 'react';
import BankUpload from '../finance/BankUpload';
import BankTransactionList from '../finance/BankTransactionList';
import { useAuth } from '../../contexts/AuthContext';
import { getMergedPermissions, UserRole } from '../../utils/roles';
import TransactionList from './TransactionList';
import PaymentStats from './PaymentStats';
import PaymentReports from './PaymentReports';
import AddPaymentModal from './AddPaymentModal';
import AddExpenseModal from './AddExpenseModal';
import ExpenseList from './ExpenseList';
import WeeklyCollectionReport from './WeeklyCollectionReport';
import ZelleReview from './ZelleReview';
import MemberSearch from './MemberSearch';
import MemberDuesViewer from './MemberDuesViewer';
import EmployeeList from './EmployeeList';
import VendorList from './VendorList';
import LoansPage from './LoansPage';
import LedgerSheetsPanel from './LedgerSheetsPanel';
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
  currentBankBalance?: number;
  lastBankUpdate?: string;
}

type TreasurerTab =
  | 'overview'
  | 'payments'
  | 'member-dues'
  | 'expenses'
  | 'loans'
  | 'bank'
  | 'reports'
  | 'employees'
  | 'vendors'
  | 'zelle'
  | 'backups';

const TreasurerDashboard: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TreasurerTab>('overview');
  const [activeReportTab, setActiveReportTab] = useState<'weekly' | 'payment'>('weekly');
  const [stats, setStats] = useState<PaymentStatsData | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [selectedMemberDuesId, setSelectedMemberDuesId] = useState<string | null>(null);
  const [memberDuesAutoSelectionEnabled, setMemberDuesAutoSelectionEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // State for skipped receipts modal
  const [showSkippedReceiptsModal, setShowSkippedReceiptsModal] = useState(false);
  const [skippedReceipts, setSkippedReceipts] = useState<number[]>([]);
  const [receiptRange, setReceiptRange] = useState<{ start: number; end: number } | null>(null);
  console.log('🏦 Firebase user:', firebaseUser);

  // Check user permissions
  const memberData = userProfile?.data?.member || userProfile || currentUser;
  const userRoles: UserRole[] = memberData?.roles || [(memberData?.role || 'member') as UserRole];
  const permissions = getMergedPermissions(userRoles);

  // Check if user has financial permissions
  const hasFinancialAccess = permissions.canViewFinancialRecords || permissions.canEditFinancialRecords;

  const primaryTabs: Array<{ id: TreasurerTab; label: string; icon: string }> = [
    { id: 'overview', label: t('treasurerDashboard.tabs.overview'), icon: 'fas fa-chart-line' },
    { id: 'payments', label: t('treasurerDashboard.tabs.payments'), icon: 'fas fa-hand-holding-usd' },
    { id: 'member-dues', label: t('treasurerDashboard.tabs.memberDues'), icon: 'fas fa-users' },
    { id: 'expenses', label: t('treasurerDashboard.tabs.expenses'), icon: 'fas fa-receipt' },
    { id: 'loans', label: t('treasurerDashboard.tabs.loans'), icon: 'fas fa-file-invoice-dollar' },
    { id: 'bank', label: t('treasurerDashboard.tabs.bank'), icon: 'fas fa-university' },
    { id: 'reports', label: t('treasurerDashboard.tabs.reports'), icon: 'fas fa-chart-bar' }
  ];

  const adminTabs: Array<{ id: TreasurerTab; label: string; icon: string }> = [
    { id: 'employees', label: t('treasurerDashboard.tabs.employees'), icon: 'fas fa-id-badge' },
    { id: 'vendors', label: t('treasurerDashboard.tabs.vendors'), icon: 'fas fa-store' },
    { id: 'zelle', label: t('treasurerDashboard.tabs.zelle'), icon: 'fas fa-mobile-alt' },
    { id: 'backups', label: t('treasurerDashboard.tabs.backups'), icon: 'fas fa-database' }
  ];

  const fetchSkippedReceipts = useCallback(async () => {
    try {
      const endpoint = '/api/transactions/skipped-receipts';
      const response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSkippedReceipts(data.data.skippedReceipts || []);
        setReceiptRange(data.data.range);
      } else {
        console.error('Failed to fetch skipped receipts');
      }
    } catch (error) {
      console.error('Error checking skipped receipts:', error);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (permissions.canEditFinancialRecords) {
      fetchSkippedReceipts();
    }
  }, [permissions.canEditFinancialRecords, fetchSkippedReceipts]);

  const openSkippedReceiptsModal = () => {
    setShowSkippedReceiptsModal(true);
  };

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
      loadAvailableYears();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFinancialAccess]);

  // Keep stats in sync when payments complete (Stripe or non-Stripe)
  useEffect(() => {
    const listener = () => fetchPaymentStats();
    window.addEventListener('payments:refresh' as any, listener);
    return () => window.removeEventListener('payments:refresh' as any, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchPaymentStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const fetchPaymentStats = async () => {
    try {
      console.log('🔍 Fetching payment stats...');
      console.log('🔍 Current user:', currentUser);
      console.log('🔍 Firebase user:', firebaseUser);

      // Clear existing stats
      setStats(null);
      setLoading(true);

      // Fetch pledge/ledger-based stats
      const endpoint = `/api/payments/stats?year=${selectedYear}`;

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
        console.log('🔍 Payment stats data received:', data);
        if (data.data) {
          console.log('🔍 Data payload:', data.data);
          console.log('🔍 Bank Balance:', data.data.currentBankBalance);
          console.log('🔍 Last Update:', data.data.lastBankUpdate);
        }
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

  const loadAvailableYears = async () => {
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/payments/stats/years`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.years?.length) setAvailableYears(data.data.years);
      }
    } catch { /* non-critical */ }
  };

  const refreshFinancialData = () => {
    fetchPaymentStats();
    if (permissions.canEditFinancialRecords) {
      fetchSkippedReceipts();
    }
  };

  const handleMemberDuesSelect = (memberId: string) => {
    setSelectedMemberDuesId(memberId);
    setMemberDuesAutoSelectionEnabled(false);
  };

  const handleMemberDuesClear = () => {
    setSelectedMemberDuesId(null);
    setMemberDuesAutoSelectionEnabled(false);
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
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 print:hidden">
          <h1 className="text-3xl font-bold text-gray-900">{t('treasurerDashboard.title')}</h1>
          <p className="mt-2 text-gray-600">{t('treasurerDashboard.subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8 print:hidden">
          <div className="space-y-5 pb-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Core Workflow
              </p>
              <div className="-mb-px overflow-x-auto">
                <nav className="flex min-w-max items-center gap-6">
                  {primaryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                    >
                      <i className={tab.icon} aria-hidden="true"></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Admin &amp; Maintenance
              </p>
              <div className="-mb-px overflow-x-auto">
                <nav className="flex min-w-max items-center gap-6">
                  {adminTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                    >
                      <i className={tab.icon} aria-hidden="true"></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
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
              {stats && (
                <PaymentStats
                  stats={stats}
                  selectedYear={selectedYear}
                  availableYears={availableYears}
                  onYearChange={setSelectedYear}
                />
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.tabs.payments')}</h2>
                <div className="flex space-x-3">
                  {permissions.canEditFinancialRecords && (
                    <>
                      {skippedReceipts.length > 0 && (
                        <button
                          onClick={openSkippedReceiptsModal}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium flex items-center"
                        >
                          <i className="fas fa-exclamation-triangle mr-2"></i>
                          {t('treasurer.skippedReceipts.button')}
                        </button>
                      )}
                      <button
                        onClick={() => setShowAddPaymentModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                      >
                        {t('treasurerDashboard.actions.addPayment')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <TransactionList
                onTransactionAdded={refreshFinancialData}
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

          {activeTab === 'loans' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Member Loans</h2>
                  <p className="text-gray-600 mt-1">Track interest-free loans from members — liabilities, not donations</p>
                </div>
              </div>
              <LoansPage />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex space-x-4 border-b border-gray-200 pb-4 mb-4 print:hidden">
                <button
                  onClick={() => setActiveReportTab('weekly')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeReportTab === 'weekly'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {t('treasurerDashboard.reports.weeklyCollection')}
                </button>
                <button
                  onClick={() => setActiveReportTab('payment')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeReportTab === 'payment'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {t('treasurerDashboard.reports.paymentReports')}
                </button>
              </div>

              {activeReportTab === 'weekly' ? (
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 print:hidden">{t('treasurerDashboard.reports.weeklyCollection')}</h2>
                  <WeeklyCollectionReport />
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6 print:hidden">{t('treasurerDashboard.reports.paymentReports')}</h2>
                  <PaymentReports paymentView="new" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'zelle' && (
            <div>
              <ZelleReview />
            </div>
          )}

          {activeTab === 'member-dues' && (
            <div>
              <div className="mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.memberDues.title')}</h2>
                  <p className="text-gray-600 mt-1">{t('treasurerDashboard.memberDues.subtitle')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <MemberSearch
                  embedded
                  autoSelectFirst={memberDuesAutoSelectionEnabled}
                  selectedMemberId={selectedMemberDuesId}
                  onMemberSelect={handleMemberDuesSelect}
                />
                <div className="min-h-[700px]">
                  {selectedMemberDuesId ? (
                    <MemberDuesViewer
                      memberId={selectedMemberDuesId}
                      embedded
                      onClose={handleMemberDuesClear}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full flex items-center justify-center p-8 text-center">
                      <div>
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
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{t('treasurerDashboard.bank.title')}</h2>
                  <p className="text-gray-600 mt-1">{t('treasurerDashboard.bank.subtitle')}</p>
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

          {activeTab === 'backups' && (
            <LedgerSheetsPanel />
          )}
        </div>

        {/* Add Payment Modal */}
        {showAddPaymentModal && (
          <AddPaymentModal
            onClose={() => setShowAddPaymentModal(false)}
            onPaymentAdded={() => {
              setShowAddPaymentModal(false);
              refreshFinancialData();
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
              refreshFinancialData();
              // Trigger refresh for expense list if on that tab
              window.dispatchEvent(new CustomEvent('expenses:refresh'));
            }}
          />
        )}

        {/* Skipped Receipts Modal */}
        {showSkippedReceiptsModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full m-4">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 flex items-center text-yellow-600">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  {t('treasurer.skippedReceipts.title')}
                </h3>
                <button
                  onClick={() => setShowSkippedReceiptsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-4">
                <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        {t('treasurer.skippedReceipts.warning')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {t('treasurer.skippedReceipts.range')}: <span className="font-semibold">{receiptRange?.start} - {receiptRange?.end}</span>
                  </p>

                  {skippedReceipts.length > 0 ? (
                    <div className="bg-gray-50 rounded-md p-3 max-h-60 overflow-y-auto border border-gray-200">
                      <div className="flex flex-wrap gap-2">
                        {skippedReceipts.map(num => (
                          <span key={num} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            #{num}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-green-600">
                      <i className="fas fa-check-circle text-2xl mb-2"></i>
                      <p>{t('treasurer.skippedReceipts.noneFound')}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  <p>{t('treasurer.skippedReceipts.note')}</p>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowSkippedReceiptsModal(false)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('treasurer.skippedReceipts.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreasurerDashboard; 
