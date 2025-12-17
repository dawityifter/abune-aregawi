import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MemberDuesViewer from './MemberDuesViewer';
import { formatMemberName } from '../../utils/formatName';

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  memberId?: string;
  yearlyPledge?: number | null;
  title?: {
    name: string;
    abbreviation?: string;
  };
}

interface MemberSearchProps {
  onMemberSelect: (memberId: string) => void;
  onClose: () => void;
}

const MemberSearch: React.FC<MemberSearchProps> = ({ onMemberSelect, onClose }) => {
  const { firebaseUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!firebaseUser) return;

      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        const params = new URLSearchParams();
        params.set('limit', '1000');
        params.set('page', '1');
        if (searchQuery.trim()) {
          params.set('search', searchQuery.trim());
        }

        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/members/all/firebase?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('🔍 MemberSearch API Response:', response.status, response.statusText);

        if (response.ok) {
          const result = await response.json();
          console.log('🔍 MemberSearch API Result:', result);

          if (result.success) {
            const membersData = result.data?.members || result.data || [];
            console.log('🔍 Members found:', membersData.length);
            setMembers(membersData);
          } else {
            console.error('🔍 API returned success=false:', result.message);
            setMembers([]);
          }
        } else {
          console.error('🔍 API request failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('🔍 Error response:', errorText);
          setMembers([]);
        }
      } catch (error) {
        console.error('🔍 Error fetching members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchMembers, searchQuery ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [firebaseUser, searchQuery]);

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(String(member.id));
    onMemberSelect(String(member.id));
  };

  // Check if member has no pledge (null, undefined, or 0)
  const hasNoPledge = (member: Member) => {
    return member.yearlyPledge === null || member.yearlyPledge === undefined || member.yearlyPledge === 0;
  };

  // Get text color based on pledge status
  const getMemberTextColor = (member: Member) => {
    return hasNoPledge(member) ? 'text-red-700' : 'text-gray-900';
  };

  // Get background color for avatar based on pledge status
  const getAvatarBgColor = (member: Member) => {
    return hasNoPledge(member) ? 'bg-red-100' : 'bg-blue-100';
  };

  // Get avatar text color based on pledge status
  const getAvatarTextColor = (member: Member) => {
    return hasNoPledge(member) ? 'text-red-600' : 'text-blue-600';
  };

  if (selectedMember) {
    return (
      <MemberDuesViewer
        memberId={selectedMember}
        onClose={() => {
          setSelectedMember(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Search Members</h2>
            <p className="text-gray-600 text-sm">Select a member to view their dues and payment history</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or member ID..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No members found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery ? 'Try adjusting your search terms.' : 'No members available.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleMemberSelect(member)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 ${getAvatarBgColor(member)} rounded-full flex items-center justify-center`}>
                            <span className={`text-sm font-medium ${getAvatarTextColor(member)}`}>
                              {member.firstName?.[0]}{member.lastName?.[0]}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className={`text-sm font-medium truncate ${getMemberTextColor(member)}`}>
                              {formatMemberName(member)}
                              {member.memberId && (
                                <span className="ml-2 text-xs text-gray-500">#{member.memberId}</span>
                              )}
                            </p>
                            {hasNoPledge(member) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                No Pledge
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ${member.yearlyPledge}/year
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            {member.email && (
                              <span className="flex items-center">
                                <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                </svg>
                                {member.email}
                              </span>
                            )}
                            {member.phoneNumber && (
                              <span className="flex items-center">
                                <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                                {member.phoneNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {members.length} member{members.length !== 1 ? 's' : ''} found
          </div>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberSearch;
