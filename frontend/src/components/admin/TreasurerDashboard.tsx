import React, { useState, useEffect, useCallback, useRef } from 'react';
import BankUpload from '../finance/BankUpload';
import BankTransactionList from '../finance/BankTransactionList';
import MonthlyBankSummary from '../finance/MonthlyBankSummary';
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
import SquareReview from './SquareReview';
import MemberSearch from './MemberSearch';
import MemberDuesViewer from './MemberDuesViewer';
import EmployeeList from './EmployeeList';
import VendorList from './VendorList';
import LoansPage from './LoansPage';
import LedgerSheetsPanel from './LedgerSheetsPanel';
import SkippedNumbersModal from './SkippedNumbersModal';
import { useLanguage } from '../../contexts/LanguageContext';

interface PaymentStatsData {
  totalMembers: number;
  contributingMembers: number;
  duesTrackedMembers?: number;
  notDuesTrackedMembers?: number;
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
  reconciliation?: {
    thresholdDollars: number;
    hasBankData: boolean;
    bankDeposits: number;
    bankDebits: number;
    receiptsReconciled: boolean;
    receiptsDifference: number;
    expensesReconciled: boolean;
    expensesDifference: number;
  };
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
  | 'square'
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

  // State for skipped check numbers modal
  const [showSkippedChecksModal, setShowSkippedChecksModal] = useState(false);
  const [skippedChecks, setSkippedChecks] = useState<number[]>([]);
  const [checkRange, setCheckRange] = useState<{ start: number; end: number } | null>(null);

  // Stats are only rendered on the Overview tab. When something changes them
  // while another tab is open, flag them instead of paying for a fetch nobody sees.
  const [statsStale, setStatsStale] = useState(false);
  const statsRequestId = useRef(0);
  const hasFetchedReceipts = useRef(false);
  const hasFetchedChecks = useRef(false);

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
    { id: 'square', label: t('treasurerDashboard.tabs.square'), icon: 'fas fa-square' },
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

  const fetchSkippedChecks = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/expenses/skipped-checks`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSkippedChecks(data.data.skippedChecks || []);
        setCheckRange(data.data.range);
      } else {
        console.error('Failed to fetch skipped checks');
      }
    } catch (error) {
      console.error('Error checking skipped checks:', error);
    }
  }, [firebaseUser]);

  // Fetch the gap lists when their tab is first opened rather than on mount —
  // a treasurer who never visits a tab shouldn't pay for its scan.
  useEffect(() => {
    if (activeTab === 'payments' && permissions.canEditFinancialRecords && !hasFetchedReceipts.current) {
      hasFetchedReceipts.current = true;
      fetchSkippedReceipts();
    }
    if (activeTab === 'expenses' && permissions.canViewExpenses && !hasFetchedChecks.current) {
      hasFetchedChecks.current = true;
      fetchSkippedChecks();
    }
  }, [activeTab, permissions.canEditFinancialRecords, permissions.canViewExpenses, fetchSkippedReceipts, fetchSkippedChecks]);

  const openSkippedReceiptsModal = () => {
    setShowSkippedReceiptsModal(true);
  };

  const openSkippedChecksModal = () => {
    setShowSkippedChecksModal(true);
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
    // Keep the previous numbers on screen while refetching. Blanking them made
    // every refresh look like a full page reload.
    const requestId = ++statsRequestId.current;
    try {
      setLoading(true);

      const endpoint = `/api/payments/stats?year=${selectedYear}`;
      const response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      // A slower earlier request must not overwrite a newer one (e.g. rapid
      // year-selector changes).
      if (requestId !== statsRequestId.current) return;

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
        setStatsStale(false);
      } else {
        console.error('❌ Payment stats API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching payment stats:', error);
    } finally {
      if (requestId === statsRequestId.current) {
        setLoading(false);
      }
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

  // Stats only exist on the Overview tab, so refetch them there and otherwise
  // just mark them stale — the tab-change effect below picks them up on arrival.
  const refreshStats = useCallback(() => {
    if (activeTab === 'overview') {
      fetchPaymentStats();
    } else {
      setStatsStale(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedYear, firebaseUser]);

  useEffect(() => {
    if (activeTab === 'overview' && statsStale && hasFinancialAccess) {
      fetchPaymentStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, statsStale, hasFinancialAccess]);

  // A payment changes both the stats and the receipt sequence.
  const refreshFinancialData = () => {
    refreshStats();
    if (permissions.canEditFinancialRecords && hasFetchedReceipts.current) {
      fetchSkippedReceipts();
    }
  };

  // An expense changes the stats and the check sequence — never the receipt
  // sequence, which is derived from transactions.
  const refreshAfterExpenseChange = () => {
    refreshStats();
    if (permissions.canViewExpenses) {
      fetchSkippedChecks();
    }
    window.dispatchEvent(new CustomEvent('expenses:refresh'));
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
                  onNavigateToBank={() => setActiveTab('bank')}
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
                <div className="flex space-x-3">
                  {skippedChecks.length > 0 && (
                    <button
                      onClick={openSkippedChecksModal}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium flex items-center"
                    >
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      {t('treasurer.skippedChecks.button')}
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
              <ExpenseList
                canEdit={permissions.canAddExpenses}
                onExpenseChanged={refreshAfterExpenseChange}
              />
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

          {activeTab === 'square' && (
            <div>
              <SquareReview />
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
                <MonthlyBankSummary />
              </div>
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
              refreshAfterExpenseChange();
            }}
          />
        )}

        {/* Skipped Receipts Modal */}
        {showSkippedReceiptsModal && (
          <SkippedNumbersModal
            title={t('treasurer.skippedReceipts.title')}
            warning={t('treasurer.skippedReceipts.warning')}
            note={t('treasurer.skippedReceipts.note')}
            rangeLabel={t('treasurer.skippedReceipts.range')}
            noneFoundLabel={t('treasurer.skippedReceipts.noneFound')}
            closeLabel={t('treasurer.skippedReceipts.close')}
            numbers={skippedReceipts}
            range={receiptRange}
            onClose={() => setShowSkippedReceiptsModal(false)}
          />
        )}

        {/* Skipped Check Numbers Modal */}
        {showSkippedChecksModal && (
          <SkippedNumbersModal
            title={t('treasurer.skippedChecks.title')}
            warning={t('treasurer.skippedChecks.warning')}
            note={t('treasurer.skippedChecks.note')}
            rangeLabel={t('treasurer.skippedChecks.range')}
            noneFoundLabel={t('treasurer.skippedChecks.noneFound')}
            closeLabel={t('treasurer.skippedChecks.close')}
            numbers={skippedChecks}
            range={checkRange}
            onClose={() => setShowSkippedChecksModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default TreasurerDashboard; 
