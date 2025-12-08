import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { fetchActivityLogs, ActivityLog } from '../../utils/activityLogApi';

const ActivityLogViewer: React.FC = () => {
    const { t } = useLanguage();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20;

    // Filters
    const [actionFilter, setActionFilter] = useState('');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');

    useEffect(() => {
        loadLogs();
    }, [page, actionFilter, entityTypeFilter]);

    const loadLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetchActivityLogs({
                page,
                limit,
                action: actionFilter || undefined,
                entityType: entityTypeFilter || undefined
            });

            setLogs(response.logs);
            setTotalPages(response.pagination.pages);
        } catch (err: any) {
            setError(err.message || 'Failed to load activity logs');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    // Helper to get logic details display
    const renderDetails = (details: any) => {
        if (!details) return '-';
        // If it's a simple object with method/url/statusCode (from middleware)
        if (details.method && details.url) {
            return (
                <span className="text-xs font-mono text-gray-500">
                    {details.method} {details.url} ({details.statusCode})
                </span>
            );
        }
        // Otherwise stringify
        return (
            <span className="text-xs text-gray-400 truncate max-w-xs block" title={JSON.stringify(details, null, 2)}>
                {JSON.stringify(details)}
            </span>
        );
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">Activity Logs</h2>
                <div className="flex flex-wrap gap-2">
                    <select
                        className="border rounded px-3 py-1 text-sm bg-white"
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">All Actions</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                    </select>

                    <select
                        className="border rounded px-3 py-1 text-sm bg-white"
                        value={entityTypeFilter}
                        onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">All Types</option>
                        <option value="Member">Member</option>
                        <option value="Donation">Donation</option>
                        <option value="Payment">Payment</option>
                    </select>

                    <button
                        onClick={() => loadLogs()}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded mb-4">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-500">
                    Loading logs...
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Entity
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Details
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                            No activity logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {log.actor ? (
                                                    <div className="text-gray-900">
                                                        {log.actor.first_name} {log.actor.last_name}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">System / Unknown</span>
                                                )}
                                                {log.ip_address && (
                                                    <div className="text-xs text-gray-400 max-w-[100px] truncate" title={log.ip_address}>
                                                        {log.ip_address}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                                                        log.action === 'CREATE' || log.action === 'POST' ? 'bg-green-100 text-green-800' :
                                                            'bg-blue-100 text-blue-800'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                {log.entity_type} <span className="text-xs text-gray-400">#{log.entity_id}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                                                {renderDetails(log.details)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className={`px-3 py-1 rounded border ${page === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                                className={`px-3 py-1 rounded border ${page === totalPages
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ActivityLogViewer;
