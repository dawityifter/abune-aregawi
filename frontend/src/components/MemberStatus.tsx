import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MemberData } from '../utils/memberDataParser';
import { allMembersData } from '../utils/mockMemberData';

const MemberStatus: React.FC = () => {
  const { t } = useLanguage();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [sortBy, setSortBy] = useState<'name' | 'balanceDue' | 'totalCollected'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [membersPerPage] = useState(20);

  // Full member data from members-2024.md - All 381 members
  const mockMembersData: MemberData[] = allMembersData;

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setMembers(mockMembersData);
      setLoading(false);
    }, 1000);
  }, [mockMembersData]);

  const filteredMembers = members
    .filter(member => 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.includes(searchTerm)
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'balanceDue':
          comparison = a.balanceDue - b.balanceDue;
          break;
        case 'totalCollected':
          comparison = a.totalCollected - b.totalCollected;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination logic
  const indexOfLastMember = currentPage * membersPerPage;
  const indexOfFirstMember = indexOfLastMember - membersPerPage;
  const currentMembers = filteredMembers.slice(indexOfFirstMember, indexOfLastMember);
  const totalPages = Math.ceil(filteredMembers.length / membersPerPage);

  const totalMembers = filteredMembers.length;
  const totalCollected = filteredMembers.reduce((sum, member) => sum + member.totalCollected, 0);
  const totalDue = filteredMembers.reduce((sum, member) => sum + member.totalAmountDue, 0);
  const totalBalance = filteredMembers.reduce((sum, member) => sum + member.balanceDue, 0);

  // Pagination functions
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getStatusColor = (balanceDue: number) => {
    if (balanceDue === 0) return 'text-green-600 bg-green-100';
    if (balanceDue <= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusText = (balanceDue: number) => {
    if (balanceDue === 0) return t('paid.up');
    if (balanceDue <= 50) return t('partial');
    return t('outstanding');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-cross text-2xl text-primary-800 mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">
                {t('member.status')} - {selectedYear}
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              {selectedYear === '2025' && (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs">
                  Coming Soon
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Year Selector */}
          <div className="mb-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setSelectedYear('2024')}
                className={`px-4 py-2 rounded-md font-medium ${
                  selectedYear === '2024'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                2024
              </button>
              <button
                onClick={() => setSelectedYear('2025')}
                className={`px-4 py-2 rounded-md font-medium ${
                  selectedYear === '2025'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={selectedYear === '2025'}
              >
                2025 (Coming Soon)
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-users text-2xl text-blue-600"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('total.members')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {totalMembers}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-dollar-sign text-2xl text-green-600"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('total.collected')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${totalCollected.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-calendar text-2xl text-purple-600"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('total.due')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${totalDue.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('balance.due')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${totalBalance.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('search.members')}
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder={t('search.placeholder')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('sort.by')}
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="name">{t('member.name')}</option>
                  <option value="balanceDue">{t('balance.due')}</option>
                  <option value="totalCollected">{t('total.collected')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('order')}
                </label>
                <select
                  id="order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="asc">{t('ascending')}</option>
                  <option value="desc">{t('descending')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('member.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('phone')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('monthly.payment')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('total.due')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('collected')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('balance')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('paid.up.to')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentMembers.map((member, index) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {indexOfFirstMember + index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {member.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {t('household')}: {member.householdCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${member.monthlyPayment}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${member.totalAmountDue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        ${member.totalCollected}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={member.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                          ${member.balanceDue}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.balanceDue)}`}>
                          {getStatusText(member.balanceDue)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.paidUpTo || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-white shadow rounded-lg p-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {t('showing')} {indexOfFirstMember + 1} {t('to')} {Math.min(indexOfLastMember, filteredMembers.length)} {t('of')} {filteredMembers.length} {t('members')}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('previous')}
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber: number;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => goToPage(pageNumber)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          currentPage === pageNumber
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-search text-4xl text-gray-400 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no.members.found')}</h3>
              <p className="text-gray-500">{t('try.adjusting.search')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MemberStatus; 