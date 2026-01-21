import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGeezTransliteration } from '../../hooks/useGeezTransliteration';
import TransliterationHelpModal from '../common/TransliterationHelpModal';

interface Member {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
}

interface Meeting {
    id?: number;
    title: string;
    meeting_date: string;
    location?: string;
    purpose?: string;
    agenda?: string;
    attendees?: number[];
    minutes?: string;
    title_ti?: string;
    purpose_ti?: string;
    agenda_ti?: string;
    minutes_ti?: string;
}

interface AddMeetingModalProps {
    departmentId: number;
    departmentMembers: Member[];
    meeting?: Meeting | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AddMeetingModal: React.FC<AddMeetingModalProps> = ({
    departmentId,
    departmentMembers,
    meeting,
    onClose,
    onSuccess
}) => {
    const { firebaseUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<'en' | 'ti'>('en');
    const [showHelp, setShowHelp] = useState(false);

    const [formData, setFormData] = useState<Meeting>({
        title: '',
        title_ti: '',
        meeting_date: new Date().toISOString().slice(0, 16),
        location: '',
        purpose: '',
        purpose_ti: '',
        agenda: '',
        agenda_ti: '',
        attendees: [],
        minutes: '',
        minutes_ti: ''
    });

    useEffect(() => {
        if (meeting) {
            setFormData({
                ...meeting,
                title: meeting.title || '',
                title_ti: meeting.title_ti || '',
                meeting_date: meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
                location: meeting.location || '',
                purpose: meeting.purpose || '',
                purpose_ti: meeting.purpose_ti || '',
                agenda: meeting.agenda || '',
                agenda_ti: meeting.agenda_ti || '',
                attendees: meeting.attendees || [],
                minutes: meeting.minutes || '',
                minutes_ti: meeting.minutes_ti || ''
            });
        }
    }, [meeting]);

    // Transliteration hooks - Now bound to MAIN fields
    const { handleChange: handleTitleChange } = useGeezTransliteration({
        enabled: inputMode === 'ti',
        value: formData.title,
        onChange: (val) => setFormData(prev => ({ ...prev, title: val }))
    });

    const { handleChange: handlePurposeChange } = useGeezTransliteration({
        enabled: inputMode === 'ti',
        value: formData.purpose || '',
        onChange: (val) => setFormData(prev => ({ ...prev, purpose: val }))
    });

    const { handleChange: handleAgendaChange } = useGeezTransliteration({
        enabled: inputMode === 'ti',
        value: formData.agenda || '',
        onChange: (val) => setFormData(prev => ({ ...prev, agenda: val }))
    });

    const { handleChange: handleMinutesChange } = useGeezTransliteration({
        enabled: inputMode === 'ti',
        value: formData.minutes || '',
        onChange: (val) => setFormData(prev => ({ ...prev, minutes: val }))
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = await firebaseUser?.getIdToken();
            const url = meeting?.id
                ? `${process.env.REACT_APP_API_URL}/api/departments/meetings/${meeting.id}`
                : `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/meetings`;

            const response = await fetch(url, {
                method: meeting?.id ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    department_id: departmentId,
                    ...formData
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to save meeting');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const toggleAttendee = (memberId: number) => {
        setFormData(prev => {
            const currentAttendees = prev.attendees || [];
            const strId = String(memberId);
            const exists = currentAttendees.some(id => String(id) === strId); // Check as string

            return {
                ...prev,
                attendees: exists
                    ? currentAttendees.filter(id => String(id) !== strId) // Remove if exists
                    : [...currentAttendees, memberId] // Add if not
            };
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
            {/* Dynamic width container */}
            <div
                className={`relative mx-auto border shadow-lg rounded-md bg-white mb-10 transition-all duration-300 ease-in-out ${showHelp ? 'w-full max-w-[90%] md:max-w-[95%]' : 'w-full max-w-3xl'
                    }`}
            >
                {/* Header Section */}
                <div className="flex justify-between items-center p-5 border-b">
                    <h3 className="text-lg font-medium text-gray-900">
                        {meeting?.id ? 'Edit Meeting' : 'Schedule New Meeting'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row h-[80vh]">
                    {/* Left Column: Form */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        {/* Keyboard Toggle */}
                        <div className="flex justify-center mb-6 items-center space-x-3">
                            <span className="text-sm font-medium text-gray-700 mr-2">Keyboard:</span>
                            <div className="bg-gray-100 p-1 rounded-lg inline-flex shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setInputMode('en')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === 'en'
                                        ? 'bg-white text-primary-700 shadow'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    English (Latin)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInputMode('ti')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === 'ti'
                                        ? 'bg-white text-primary-700 shadow'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    ትግርኛ (Ge'ez)
                                </button>
                            </div>

                            {inputMode === 'ti' && (
                                <button
                                    type="button"
                                    onClick={() => setShowHelp(!showHelp)}
                                    className={`p-2 rounded-full transition-colors ${showHelp
                                        ? 'bg-primary-100 text-primary-800'
                                        : 'text-primary-600 hover:text-primary-800 hover:bg-gray-100'
                                        }`}
                                    title="Toggle Ge'ez Transliteration Guide"
                                >
                                    <i className="fas fa-keyboard text-xl"></i>
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Title */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Meeting Title <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={handleTitleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder={inputMode === 'ti' ? 'ርእሲ ኣኼባ ኣብዚ ጸሓፍ (typing "selam" → "ሰላም")' : 'Enter meeting title'}
                                    />
                                    {inputMode === 'ti' && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Type phonetically (e.g. "selam" → "ሰላም"). Text is appended to existing content.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date & Time <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.meeting_date}
                                        onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* Purpose */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Purpose
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.purpose || ''}
                                        onChange={handlePurposeChange}
                                        placeholder={inputMode === 'ti' ? 'ዕላማ ኣኼባ' : 'Short description of the meeting purpose'}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* Agenda */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Agenda
                                    </label>
                                    <textarea
                                        value={formData.agenda || ''}
                                        onChange={handleAgendaChange}
                                        rows={4}
                                        placeholder={inputMode === 'ti' ? 'ዝርዝር ዛዕባታት...' : 'Detailed agenda for the meeting'}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Attendees
                                    </label>
                                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 space-y-2">
                                        {departmentMembers.map((member) => (
                                            <label
                                                key={member.id}
                                                className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.attendees?.some(id => String(id) === String(member.id))}
                                                    onChange={() => toggleAttendee(member.id)}
                                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                />
                                                <span className="ml-3 text-sm text-gray-700">
                                                    {member.first_name} {member.last_name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Meeting Notes */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Meeting Notes / Minutes
                                    </label>
                                    <textarea
                                        value={formData.minutes || ''}
                                        onChange={handleMinutesChange}
                                        rows={6}
                                        placeholder={inputMode === 'ti' ? 'ቃለ ጉባኤ ኣብዚ ጸሓፍ...' : 'Meeting notes and minutes...'}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : (meeting?.id ? 'Update Meeting' : 'Create Meeting')}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Column: Help Panel */}
                    {showHelp && (
                        <div className="w-full lg:w-1/2 border-l border-gray-200 bg-gray-50 overflow-hidden flex flex-col transition-all duration-300">
                            <TransliterationHelpModal
                                isOpen={true}
                                onClose={() => setShowHelp(false)}
                                variant="embedded"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddMeetingModal;
