import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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

    const [formData, setFormData] = useState<Meeting>({
        title: '',
        meeting_date: new Date().toISOString().slice(0, 16),
        location: '',
        purpose: '',
        agenda: '',
        attendees: [],
        minutes: ''
    });

    useEffect(() => {
        if (meeting) {
            setFormData({
                ...meeting,
                meeting_date: meeting.meeting_date ? new Date(meeting.meeting_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
            });
        }
    }, [meeting]);

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
                    ...formData,
                    department_id: departmentId
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
        setFormData(prev => ({
            ...prev,
            attendees: prev.attendees?.includes(memberId)
                ? prev.attendees.filter(id => id !== memberId)
                : [...(prev.attendees || []), memberId]
        }));
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white mb-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                        {meeting?.id ? 'Edit Meeting' : 'Create New Meeting'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
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

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Purpose
                            </label>
                            <input
                                type="text"
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                placeholder="Short description of the meeting purpose"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Agenda
                            </label>
                            <textarea
                                value={formData.agenda}
                                onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                                rows={4}
                                placeholder="Detailed agenda for the meeting"
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
                                            checked={formData.attendees?.includes(member.id)}
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

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Meeting Notes
                            </label>
                            <textarea
                                value={formData.minutes}
                                onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                                rows={6}
                                placeholder="Meeting notes and minutes..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
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
        </div>
    );
};

export default AddMeetingModal;
