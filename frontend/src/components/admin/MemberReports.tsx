import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MemberInfoRow {
  id: number | string;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  spouse_phone?: string | null;
}

interface MemberInfoData {
  generatedAt?: string;
  totalActiveMembers?: number;
  members: MemberInfoRow[];
}

interface HouseholdDependent { name: string; relationship?: string | null; phone?: string | null; age?: number | null }
interface HouseholdPerson { name: string; phone?: string | null; age?: number | null }
interface Household {
  headId: number | string;
  householdName: string;
  head: HouseholdPerson;
  spouse: HouseholdPerson | null;
  dependents: HouseholdDependent[];
  otherFamilyMembers: HouseholdPerson[];
}
interface HouseholdData {
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalHouseholds: number;
    totalParishMembers: number;
    totalHeads: number;
    totalSpouses: number;
    totalDependents: number;
  };
  households: Household[];
}

const PAGE_SIZE = 20;

// E.164 US numbers render as (xxx) xxx-xxxx; anything else passes through.
const formatPhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
};

// Parenthetical after a person's name: relationship and age joined with ", ".
// (Son, 16) / (Daughter) / (16) / undefined -> no parentheses.
const personDetail = (relationship?: string | null, age?: number | null): string | undefined => {
  const parts = [relationship || null, age === null || age === undefined ? null : String(age)].filter(
    (p): p is string => Boolean(p)
  );
  return parts.length > 0 ? parts.join(', ') : undefined;
};

const MemberReports: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();

  const [reportType, setReportType] = useState<'household_directory' | 'member_information'>('household_directory');
  const [memberInfo, setMemberInfo] = useState<MemberInfoData | null>(null);
  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(false);

  const [sortBy, setSortBy] = useState<'last_name' | 'first_name'>('last_name');
  const [page, setPage] = useState(1);
  // Tracks the sortBy value the currently-loaded householdData was fetched
  // with, so switching report type back to household_directory reuses the
  // cached data instead of refetching when the sort hasn't changed.
  const lastFetchedSortBy = useRef<'last_name' | 'first_name' | null>(null);

  const fetchMemberInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/reports/member-information`, {
        headers: { Authorization: `Bearer ${await firebaseUser?.getIdToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMemberInfo(data.data);
      }
    } catch (error) {
      console.error('Error fetching member information report:', error);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  const fetchHouseholds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort_by: sortBy });
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/members/reports/household-directory?${params.toString()}`,
        { headers: { Authorization: `Bearer ${await firebaseUser?.getIdToken()}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setHouseholdData(data.data);
        setPage(1);
        lastFetchedSortBy.current = sortBy;
      }
    } catch (error) {
      console.error('Error fetching household directory report:', error);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, sortBy]);

  // Deliberately keyed on the primitives (reportType, sortBy) rather than on
  // fetchHouseholds/fetchMemberInfo/memberInfo/householdData: those values are
  // still read fresh inside the effect (via closure) to decide whether to
  // fetch, but including them in the dep array would re-run this effect on
  // every state change the fetch itself causes (loading/data/page), which —
  // combined with fetchHouseholds/fetchMemberInfo's identities changing
  // whenever firebaseUser's reference changes — can retrigger fetches whose
  // previous call hasn't resolved yet. Keying on the primitives means this
  // only re-runs on an actual report-type switch or sort change.
  useEffect(() => {
    if (reportType === 'member_information' && !memberInfo) {
      fetchMemberInfo();
    } else if (reportType === 'household_directory' && (!householdData || lastFetchedSortBy.current !== sortBy)) {
      // Skips the fetch when switching back to household_directory with an
      // unchanged sortBy (reuses cached householdData + current page);
      // fetches on initial mount (no householdData yet) and whenever sortBy
      // changes from what the cached data was fetched with.
      fetchHouseholds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, sortBy]);

  const renderSummary = (data: HouseholdData) => (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 print:bg-white print:border-gray-400" style={{ breakInside: 'avoid' }}>
      <h4 className="font-bold text-gray-900 mb-2">{t('householdReport.summaryTitle')}</h4>
      <ul className="text-sm text-gray-800 space-y-0.5">
        <li>{t('householdReport.totalFamilies')}: <span className="font-semibold">{data.summary.totalHouseholds}</span></li>
        <li>{t('householdReport.totalParishMembers')}: <span className="font-semibold">{data.summary.totalParishMembers}</span></li>
        <li>{t('householdReport.totalHeads')}: <span className="font-semibold">{data.summary.totalHeads}</span></li>
        <li>{t('householdReport.totalSpouses')}: <span className="font-semibold">{data.summary.totalSpouses}</span></li>
        <li>{t('householdReport.totalDependents')}: <span className="font-semibold">{data.summary.totalDependents}</span></li>
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        {t('householdReport.generatedOn')}: {new Date(data.generatedAt).toLocaleString()}
        {' · '}
        {t('householdReport.generatedBy')}: {data.generatedBy}
      </p>
    </div>
  );

  const renderPerson = (label: string, people: Array<{ name: string; detail?: string | null; phone?: string | null }>) => (
    <div className="mt-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide print:text-gray-700">{label}</div>
      {people.map((p, i) => (
        <div key={i} className="ml-3 mt-0.5 text-sm text-gray-900">
          <div>• {p.name}{p.detail ? ` (${p.detail})` : ''}</div>
          {formatPhone(p.phone) && (
            <div className="ml-4 text-gray-600">{t('householdReport.mobile')}: {formatPhone(p.phone)}</div>
          )}
        </div>
      ))}
    </div>
  );

  const renderHousehold = (h: Household, onPage: boolean) => {
    const dependentEntries = [
      ...h.dependents.map((d) => ({ name: d.name, detail: personDetail(d.relationship, d.age), phone: d.phone })),
      ...h.otherFamilyMembers.map((m) => ({ name: m.name, detail: personDetail(null, m.age), phone: m.phone }))
    ];

    return (
      <div
        key={String(h.headId)}
        className={`border border-gray-200 rounded-lg p-4 print:border-0 print:border-b print:border-gray-300 print:rounded-none ${onPage ? '' : 'hidden print:block'}`}
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div className="flex items-baseline justify-between border-b border-gray-100 pb-1 print:border-gray-300">
          <h4 className="font-bold text-gray-900">{h.householdName}</h4>
          <span className="text-xs text-gray-500">{t('householdReport.memberId')}: {h.headId}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-6">
          <div>
            {renderPerson(t('householdReport.headOfHousehold'), [h.head])}
            {h.spouse && renderPerson(t('householdReport.spouse'), [h.spouse])}
          </div>
          <div>
            {dependentEntries.length > 0 && renderPerson(t('householdReport.dependentsSection'), dependentEntries)}
          </div>
        </div>
      </div>
    );
  };

  const renderHouseholdReport = () => {
    if (!householdData) return null;
    const totalPages = Math.max(1, Math.ceil(householdData.households.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return (
      <div className="space-y-4 print:space-y-2">
        {renderSummary(householdData)}
        {householdData.households.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('householdReport.noResults')}</p>
        ) : (
          <>
            {householdData.households.map((h, i) => renderHousehold(h, i >= start && i < end))}
            {renderSummary(householdData)}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-4 print:hidden">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  {t('householdReport.previous')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('householdReport.page')} {page} {t('householdReport.of')} {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  {t('householdReport.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderMemberInfoReport = () => {
    if (!memberInfo?.members) return null;
    const mi = 'memberInfoReport';
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:rounded-none">
        <div className="px-6 py-4 border-b border-gray-200 print:border-gray-800 print:text-center">
          <h3 className="text-lg font-bold text-gray-900 print:font-serif print:text-xl">{t(`${mi}.title`)}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t(`${mi}.generated`)}: {memberInfo.generatedAt ? new Date(memberInfo.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
            {' · '}
            {t(`${mi}.activeMembers`)}: {memberInfo.totalActiveMembers ?? memberInfo.members.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 print:text-xs">
            <thead className="bg-gray-50 print:bg-white">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colId`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colFirstName`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colLastName`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colPhone`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpouseFirst`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpouseLast`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpousePhone`)}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {memberInfo.members.map((m) => (
                <tr key={String(m.id)} className="even:bg-gray-50 print:even:bg-white" style={{ breakInside: 'avoid' }}>
                  <td className="px-4 py-2 text-right text-sm text-gray-900 tabular-nums whitespace-nowrap">{m.id}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{m.first_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{m.last_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 tabular-nums whitespace-nowrap">{m.phone_number || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{m.spouse_first_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{m.spouse_last_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 tabular-nums whitespace-nowrap">{m.spouse_phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Print header: logo, church name, report title, generation date */}
      <div className="hidden print:block text-center mb-6">
        <img
          src="/cropped-AbuneAregawi-192x192.png"
          alt=""
          className="mx-auto mb-2"
          style={{ width: '64px', height: '64px' }}
        />
        <h1 className="text-2xl font-bold text-gray-900 font-serif">Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church</h1>
        <h2 className="text-lg font-semibold text-gray-800 mt-1">
          {reportType === 'household_directory' ? t('householdReport.title') : t('memberInfoReport.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Report selector + actions */}
      <div className="bg-white rounded-lg shadow-md p-6 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <label htmlFor="memberReportType" className="text-sm font-medium text-gray-700">{t('memberReports.selectLabel')}</label>
          <select
            id="memberReportType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'household_directory' | 'member_information')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="household_directory">{t('memberReports.householdDirectory')}</option>
            <option value="member_information">{t('memberReports.memberInformation')}</option>
          </select>
          {reportType === 'household_directory' && (
            <div className="flex items-center gap-2">
              <label htmlFor="householdSortBy" className="text-sm font-medium text-gray-700">{t('householdReport.sortBy')}</label>
              <select
                id="householdSortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'last_name' | 'first_name')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="last_name">{t('householdReport.sortLastName')}</option>
                <option value="first_name">{t('householdReport.sortFirstName')}</option>
              </select>
            </div>
          )}
          <button
            onClick={() => window.print()}
            disabled={loading || (reportType === 'household_directory' ? !householdData : !memberInfo)}
            className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-print mr-2"></i>
            {t('common.print')}
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || (reportType === 'household_directory' ? !householdData : !memberInfo)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-file-pdf mr-2"></i>
            {t('householdReport.savePdf')}
          </button>
        </div>
      </div>

      {/* Report body */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {reportType === 'household_directory' && renderHouseholdReport()}
          {reportType === 'member_information' && renderMemberInfoReport()}
        </div>
      )}
    </div>
  );
};

export default MemberReports;
