import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions } from '../../utils/roles';
import TransactionList from './TransactionList';
import PaymentStats from './PaymentStats';
import PaymentReports from './PaymentReports';
import AddPaymentModal from './AddPaymentModal';
import AddExpenseModal from './AddExpenseModal';
import ExpenseList from './ExpenseList';
import WeeklyCollectionReport from './WeeklyCollectionReport';
import ZelleReview from './ZelleReview';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses' | 'reports' | 'zelle'>('overview');
  const [stats, setStats] = useState<PaymentStatsData | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  console.log('🏦 TreasurerDashboard: Component loaded');
  console.log('🏦 Current user:', currentUser);
  console.log('🏦 Firebase user:', firebaseUser);

  // Check user permissions
  const userRole = userProfile?.data?.member?.role || currentUser?.role || 'member';
  const permissions = getRolePermissions(userRole);
  
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
            <p>Access Denied</p>
            <p className="text-sm text-gray-600 mt-2">
              You don't have permission to access the Treasurer Dashboard.
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
          <h1 className="text-3xl font-bold text-gray-900">Treasurer Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage member payments and generate reports</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <div className="-mb-px flex items-center justify-between">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Member Payments
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'expenses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reports'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => setActiveTab('zelle')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'zelle'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Zelle Review
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Payment Overview</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Add Payment
                  </button>
                  {permissions.canAddExpenses && (
                    <button
                      onClick={() => setShowAddExpenseModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
                    >
                      Add Expense
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
                <h2 className="text-2xl font-semibold text-gray-900">Member Payments</h2>
                <button
                  onClick={() => setShowAddPaymentModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                >
                  Add Payment
                </button>
              </div>
              <TransactionList 
                onTransactionAdded={fetchPaymentStats} 
              />
            </div>
          )}

          {activeTab === 'expenses' && permissions.canViewExpenses && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Expenses</h2>
                {permissions.canAddExpenses && (
                  <button
                    onClick={() => setShowAddExpenseModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Add Expense
                  </button>
                )}
              </div>
              <ExpenseList />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">📅 Weekly Collection Report</h2>
                <WeeklyCollectionReport />
              </div>
              
              <div className="border-t pt-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Payment Reports</h2>
                <PaymentReports paymentView="new" />
              </div>
            </div>
          )}

          {activeTab === 'zelle' && (
            <div>
              <ZelleReview />
            </div>
          )}
        </div>

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