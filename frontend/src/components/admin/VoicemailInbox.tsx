import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
    const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

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

    if (loading && voicemails.length === 0) {
        return <div className="p-4 text-center">Loading inbox...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-600">Error: {error}</div>;
    }

    return (
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
    );
};

export default VoicemailInbox;
