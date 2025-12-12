import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getVoicemails, archiveVoicemail } from '../../utils/voicemailApi';

interface Voicemail {
    id: number;
    fromNumber: string;
    recordingUrl: string;
    recordingDuration: number;
    transcriptionText: string | null;
    createdAt: string;
}

// Helper component to fetch audio with auth headers
const SecureAudioPlayer: React.FC<{ streamUrl: string }> = ({ streamUrl }) => {
    const { firebaseUser } = useAuth();
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        let objectUrl: string | null = null;

        const fetchAudio = async () => {
            if (!firebaseUser) return;
            try {
                const token = await firebaseUser.getIdToken();
                const res = await fetch(streamUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load audio');

                const blob = await res.blob();
                if (active) {
                    objectUrl = URL.createObjectURL(blob);
                    setAudioSrc(objectUrl);
                }
            } catch (e) {
                if (active) setError(true);
            }
        };

        fetchAudio();

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [streamUrl, firebaseUser]);

    if (error) return <span className="text-xs text-red-500">Failed to load</span>;
    if (!audioSrc) return <span className="text-xs text-gray-400">Loading audio...</span>;

    return <audio controls src={audioSrc} className="h-8 w-40" />;
};

const VoicemailInbox: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();
    const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [volunteerRequests, setVolunteerRequests] = useState<any[]>([]);
    const [volPage, setVolPage] = useState(1);
    const [volTotalPages, setVolTotalPages] = useState(1);

    const fetchVoicemails = async () => {
        if (!firebaseUser) return;
        try {
            setLoading(true);
            const token = await firebaseUser.getIdToken();
            const response = await getVoicemails(token, page, 10);

            if (response.success) {
                setVoicemails(response.data.voicemails);
                setTotalPages(response.data.pagination.pages);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVoicemails();
    }, [firebaseUser, page]);

    const handleArchive = async (id: number) => {
        if (!firebaseUser) return;
        if (!window.confirm('Delete this voicemail?')) return;
        try {
            const token = await firebaseUser.getIdToken();
            await archiveVoicemail(token, id);
            // Remove from local state
            setVoicemails(prev => prev.filter(vm => vm.id !== id));
        } catch (err: any) {
            alert('Failed to delete voicemail: ' + err.message);
        }
    };

    const fetchVolunteerRequests = async () => {
        if (!firebaseUser) return;
        try {
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
            // Fetch only 'new' requests
            const res = await fetch(`${apiUrl}/api/volunteers?page=${volPage}&limit=5&status=new`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setVolunteerRequests(data.data.requests);
                setVolTotalPages(data.data.pagination.pages);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkContacted = async (id: number) => {
        if (!firebaseUser) return;
        if (!window.confirm('Mark this request as responded? It will be hidden from this list.')) return;
        try {
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
            const res = await fetch(`${apiUrl}/api/volunteers/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'contacted' })
            });

            if (res.ok) {
                // Remove from list
                setVolunteerRequests(prev => prev.filter(r => r.id !== id));
            } else {
                alert("Failed to update status");
            }
        } catch (err) {
            console.error(err);
            alert("Error updating status");
        }
    };

    useEffect(() => {
        fetchVolunteerRequests();
    }, [firebaseUser, volPage]);

    if (loading && voicemails.length === 0) {
        return <div className="p-4 text-center">Loading inbox...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-600">Error: {error}</div>;
    }



    return (
        <div className="space-y-8">
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Voicemail Inbox</h2>
                    <button
                        onClick={fetchVoicemails}
                        className="text-primary-600 hover:text-primary-800"
                    >
                        <i className="fas fa-sync-alt mr-1"></i> Refresh
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recording</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transcription</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {voicemails.map((vm) => (
                                <tr key={vm.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(vm.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {vm.fromNumber}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {vm.recordingDuration}s
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <SecureAudioPlayer streamUrl={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/twilio/admin/voicemails/${vm.id}/stream`} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        <span title={vm.transcriptionText || 'No transcription available'}>
                                            {vm.transcriptionText || <em className="text-gray-400">Pending...</em>}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleArchive(vm.id)}
                                            className="text-red-600 hover:text-red-900"
                                            title="Delete voicemail"
                                        >
                                            <i className="fas fa-trash mr-1"></i> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {voicemails.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No voicemails found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center mt-4 space-x-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1">Page {page} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Volunteer Requests Section */}
            <div className="bg-white shadow rounded-lg p-6 border-l-4 border-amber-500">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('admin.volunteer.requests')}</h2>
                        <p className="text-sm text-gray-500">{t('admin.volunteer.requests.desc')}</p>
                    </div>
                    <button
                        onClick={fetchVolunteerRequests}
                        className="text-primary-600 hover:text-primary-800"
                    >
                        <i className="fas fa-sync-alt mr-1"></i> Refresh
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {volunteerRequests.map((req) => (
                                <tr key={req.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(req.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {req.member ? `${req.member.first_name} ${req.member.last_name}` : 'Unknown'}
                                        <div className="text-xs text-gray-500">{req.member?.phone_number}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                                        <div className="mb-1">{req.message}</div>
                                        {req.agreedToContact && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                <i className="fas fa-phone-alt mr-1"></i> {t('admin.call.requested')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleMarkContacted(req.id)}
                                            className="text-primary-600 hover:text-primary-900 bg-primary-50 px-3 py-1 rounded-md border border-primary-200 transition-colors"
                                        >
                                            <i className="fas fa-check mr-1"></i> {t('admin.responded')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {volunteerRequests.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        {t('admin.no.new.requests')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {volTotalPages > 1 && (
                    <div className="flex justify-center mt-4 space-x-2">
                        <button
                            onClick={() => setVolPage(p => Math.max(1, p - 1))}
                            disabled={volPage === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1">Page {volPage} of {volTotalPages}</span>
                        <button
                            onClick={() => setVolPage(p => Math.min(volTotalPages, p + 1))}
                            disabled={volPage === volTotalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoicemailInbox;
