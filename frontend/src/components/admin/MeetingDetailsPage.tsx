import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AddTaskModal from './AddTaskModal';
import AddMeetingModal from './AddMeetingModal';
import MeetingEmailModal from './MeetingEmailModal';
import { LanguageContext } from '../../contexts/LanguageContext';


interface Member {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
}

interface Task {
    id?: number;
    title: string;
    description?: string;
    assigned_to?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: Member;
    due_date?: string;
    start_date?: string;
    end_date?: string;
    rejected_date?: string;
    notes?: string;
}

interface Meeting {
    id: number;
    department_id?: number;
    title: string;
    meeting_date: string;
    location?: string;
    purpose?: string;
    agenda?: string;
    minutes?: string;
    title_ti?: string;
    purpose_ti?: string;
    agenda_ti?: string;
    minutes_ti?: string;
    attendees?: number[];
    creator?: Member;
    tasks?: Task[];
}



const MeetingDetailsPage: React.FC = () => {
    const { t } = React.useContext(LanguageContext)!;

    const { departmentId, meetingId } = useParams<{ departmentId: string; meetingId: string }>();
    const navigate = useNavigate();
    const { firebaseUser, currentUser } = useAuth();

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [previousMeeting, setPreviousMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showEditMeetingModal, setShowEditMeetingModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [departmentMembers, setDepartmentMembers] = useState<Member[]>([]);
    const [departmentName, setDepartmentName] = useState<string>('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [canEmailMeeting, setCanEmailMeeting] = useState(false);
    const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchMeetingDetails = useCallback(async () => {
        try {
            setLoading(true);
            const token = await firebaseUser?.getIdToken();

            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/departments/meetings/${meetingId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch meeting');
            }

            const data = await response.json();
            setMeeting(data.data.meeting);
            setPreviousMeeting(data.data.previousMeeting);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [firebaseUser, meetingId]);

    const fetchDepartmentMembers = useCallback(async () => {
        try {
            const token = await firebaseUser?.getIdToken();
            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/members`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setDepartmentMembers(data.data.members.map((m: any) => m.member));
            }
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    }, [departmentId, firebaseUser]);

    const fetchDepartmentDetails = useCallback(async () => {
        try {
            const token = await firebaseUser?.getIdToken();
            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setDepartmentName(data.data.department?.name || '');
            }
        } catch (err) {
            console.error('Error fetching department details:', err);
        }
    }, [departmentId, firebaseUser]);

    useEffect(() => {
        fetchMeetingDetails();
        fetchDepartmentMembers();
        fetchDepartmentDetails();
    }, [fetchMeetingDetails, fetchDepartmentMembers, fetchDepartmentDetails]);

    const checkMeetingEmailPermission = useCallback(async () => {
        const userRoles: string[] = (currentUser?.roles || [currentUser?.role]).filter(Boolean);
        if (userRoles.some(role => ['admin', 'church_leadership'].includes(role))) {
            setCanEmailMeeting(true);
            return;
        }

        if (!firebaseUser || !departmentId || !meetingId) {
            setCanEmailMeeting(false);
            return;
        }

        try {
            const token = await firebaseUser.getIdToken();
            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/meetings/${meetingId}/email-preview`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setCanEmailMeeting(response.ok);
        } catch (_) {
            setCanEmailMeeting(false);
        }
    }, [currentUser?.role, currentUser?.roles, departmentId, firebaseUser, meetingId]);

    useEffect(() => {
        checkMeetingEmailPermission();
    }, [checkMeetingEmailPermission]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            case 'cancelled': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-100 text-red-800';
            case 'high': return 'bg-orange-100 text-orange-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formattedMeetingDate = new Date(meeting?.meeting_date || '').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const shortGeneratedDate = new Date().toLocaleDateString();
    const attendeeMembers = departmentMembers.filter(m => meeting?.attendees?.includes(m.id));

    const handlePrint = () => {
        const originalTitle = document.title;
        const safeTitle = (meeting?.title || 'meeting-record').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        document.title = safeTitle || 'meeting-record';
        window.print();
        window.setTimeout(() => {
            document.title = originalTitle;
        }, 500);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        {error || 'Meeting not found'}
                    </h2>
                    <button
                        onClick={() => navigate(`/departments/${departmentId}`)}
                        className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                    >
                        Back to Department
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-16">
            <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 print:max-w-none print:py-0 print:px-0">
                <div className="hidden print:block mb-8 border-b-2 border-gray-900 pb-5">
                    <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
                            Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church
                        </p>
                        <h1 className="mt-3 text-3xl font-bold text-gray-900 font-serif">
                            {meeting.title}
                        </h1>
                        {meeting.title_ti && (
                            <p className="mt-2 text-lg text-gray-700 font-serif">{meeting.title_ti}</p>
                        )}
                        <p className="mt-3 text-sm text-gray-600">
                            {t('meeting.print.record')}
                            {departmentName ? ` • ${departmentName}` : ''}
                        </p>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                            <span className="font-semibold text-gray-900">{t('meeting.print.department')}:</span>{' '}
                            {departmentName || t('meeting.print.notProvided')}
                        </div>
                        <div>
                            <span className="font-semibold text-gray-900">{t('meeting.print.generated')}:</span>{' '}
                            {shortGeneratedDate}
                        </div>
                        <div>
                            <span className="font-semibold text-gray-900">{t('meeting.print.location')}:</span>{' '}
                            {meeting.location || t('meeting.print.notProvided')}
                        </div>
                        <div>
                            <span className="font-semibold text-gray-900">{t('meeting.print.date')}:</span>{' '}
                            {formattedMeetingDate}
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="mb-6 print:mb-4">
                    <button
                        onClick={() => navigate(`/departments/${departmentId}`)}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center print:hidden"
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        {t('common.back')}
                    </button>

                    <div className="bg-white shadow rounded-lg p-6 print:shadow-none print:border print:border-gray-300 print:rounded-none">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
                                {meeting.title_ti && (
                                    <h2 className="text-xl font-medium text-gray-600 mt-1">{meeting.title_ti}</h2>
                                )}
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                                    <span>
                                        <i className="fas fa-calendar mr-1"></i>
                                        {formattedMeetingDate}
                                    </span>
                                    {departmentName && (
                                        <span>
                                            <i className="fas fa-sitemap mr-1"></i>
                                            {departmentName}
                                        </span>
                                    )}
                                    {meeting.location && (
                                        <span>
                                            <i className="fas fa-map-marker-alt mr-1"></i>
                                            {meeting.location}
                                        </span>
                                    )}
                                </div>
                                {meeting.purpose && (
                                    <p className="text-gray-700 mt-2">{meeting.purpose}</p>
                                )}
                                {meeting.purpose_ti && (
                                    <p className="text-gray-600 mt-1 italic">{meeting.purpose_ti}</p>
                                )}
                            </div>
                            <div className="flex gap-2 print:hidden">
                                {canEmailMeeting && (
                                    <button
                                        onClick={() => {
                                            setEmailFeedback(null);
                                            setShowEmailModal(true);
                                        }}
                                        className="inline-flex items-center px-4 py-2 border border-primary-200 text-sm font-medium rounded-md shadow-sm text-primary-700 bg-primary-50 hover:bg-primary-100"
                                    >
                                        <i className="fas fa-envelope mr-2"></i>
                                        {t('meeting.email.button')}
                                    </button>
                                )}
                                <button
                                    onClick={handlePrint}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    <i className="fas fa-print mr-2"></i>
                                    {t('meeting.print.savePdf')}
                                </button>
                                <button
                                    onClick={() => setShowEditMeetingModal(true)}
                                    className="text-primary-600 hover:text-primary-700"
                                    title="Edit meeting"
                                >
                                    <i className="fas fa-edit text-lg"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Previous Meeting Tasks */}
                {emailFeedback && (
                    <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                        emailFeedback.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                    }`}>
                        {emailFeedback.message}
                    </div>
                )}

                {previousMeeting && previousMeeting.tasks && previousMeeting.tasks.length > 0 && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6 print:shadow-none print:border print:border-gray-300 print:rounded-none print:break-inside-avoid">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-history mr-2 text-gray-600"></i>
                            {t('meeting.tasks.previous')}
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({new Date(previousMeeting.meeting_date).toLocaleDateString()})
                            </span>
                        </h2>
                        <div className="space-y-3">
                            {previousMeeting.tasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                            <span className="font-medium text-gray-900">{task.title}</span>
                                        </div>
                                        {task.assignee && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                {t('meeting.assignedTo')}: {task.assignee.first_name} {task.assignee.last_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Current Meeting Tasks */}
                <div className="bg-white shadow rounded-lg p-6 mb-6 print:shadow-none print:border print:border-gray-300 print:rounded-none print:break-inside-avoid">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                            <i className="fas fa-tasks mr-2 text-gray-600"></i>
                            {t('meeting.tasks.actionItems')}
                        </h2>
                        <button
                            onClick={() => {
                                setSelectedTask(null);
                                setShowAddTaskModal(true);
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 print:hidden"
                        >
                            <i className="fas fa-plus mr-2"></i>
                            {t('meeting.tasks.add')}
                        </button>
                    </div>

                    {meeting.tasks && meeting.tasks.length > 0 ? (
                        <div className="space-y-3">
                            {meeting.tasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 print:break-inside-avoid">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                {task.priority}
                                            </span>
                                            <span className="font-medium text-gray-900">{task.title}</span>
                                        </div>
                                        {task.description && (
                                            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                            {task.assignee && (
                                                <span>
                                                    <i className="fas fa-user mr-1"></i>
                                                    {task.assignee.first_name} {task.assignee.last_name}
                                                </span>
                                            )}
                                            {task.end_date && (
                                                <span>
                                                    <i className="fas fa-calendar mr-1"></i>
                                                    {t('meeting.due')}: {new Date(task.end_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedTask(task);
                                            setShowAddTaskModal(true);
                                        }}
                                        className="text-primary-600 hover:text-primary-700 ml-4 print:hidden"
                                        title="Edit task"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">{t('meeting.tasks.none')}</p>
                    )}
                </div>

                {/* Agenda */}
                {(meeting.agenda || meeting.agenda_ti) && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6 print:shadow-none print:border print:border-gray-300 print:rounded-none">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-list-ul mr-2 text-gray-600"></i>
                            {t('meeting.agenda')}
                        </h2>
                        {meeting.agenda && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4 last:mb-0">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('meeting.print.language.english')}</h3>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {meeting.agenda}
                                </div>
                            </div>
                        )}
                        {meeting.agenda_ti && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('meeting.print.language.tigrinya')}</h3>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap font-serif">
                                    {meeting.agenda_ti}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Meeting Notes */}
                {(meeting.minutes || meeting.minutes_ti) && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6 print:shadow-none print:border print:border-gray-300 print:rounded-none">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-file-alt mr-2 text-gray-600"></i>
                            {t('meeting.minutes')}
                        </h2>
                        {meeting.minutes && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4 last:mb-0">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('meeting.print.language.english')}</h3>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {meeting.minutes}
                                </div>
                            </div>
                        )}
                        {meeting.minutes_ti && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('meeting.print.language.tigrinya')}</h3>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap font-serif">
                                    {meeting.minutes_ti}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Attendees */}
                <div className="bg-white shadow rounded-lg p-6 print:shadow-none print:border print:border-gray-300 print:rounded-none print:break-inside-avoid">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-users mr-2 text-gray-600"></i>
                            {t('meeting.attendees')}
                            {meeting.attendees && meeting.attendees.length > 0 && (
                                <span className="ml-2 text-base font-normal text-gray-500">({meeting.attendees.length})</span>
                            )}
                        </h2>
                        {attendeeMembers.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {attendeeMembers.map((member) => (
                                    <div key={member.id} className="flex items-center p-2 bg-gray-50 rounded">
                                        <i className="fas fa-user-circle text-gray-400 mr-2"></i>
                                        <span className="text-sm text-gray-700">
                                            {member.first_name} {member.last_name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500">{t('meeting.print.noAttendees')}</p>
                        )}
                </div>

                <div className="hidden print:block mt-8 border-t border-gray-300 pt-3 text-center text-xs text-gray-500">
                    {t('meeting.print.generated')}: {shortGeneratedDate} • https://abunearegawi.church
                </div>

                {/* Modals */}
                {showAddTaskModal && (
                    <AddTaskModal
                        departmentId={parseInt(departmentId!)}
                        meetingId={parseInt(meetingId!)}
                        departmentMembers={departmentMembers}
                        task={selectedTask}
                        onClose={() => {
                            setShowAddTaskModal(false);
                            setSelectedTask(null);
                        }}
                        onSuccess={() => {
                            fetchMeetingDetails();
                        }}
                    />
                )}

                {showEditMeetingModal && (
                    <AddMeetingModal
                        departmentId={parseInt(departmentId!)}
                        departmentMembers={departmentMembers as any}
                        meeting={meeting}
                        onClose={() => setShowEditMeetingModal(false)}
                        onSuccess={() => {
                            fetchMeetingDetails();
                            setShowEditMeetingModal(false);
                        }}
                    />
                )}

                {showEmailModal && (
                    <MeetingEmailModal
                        departmentId={departmentId!}
                        meetingId={meetingId!}
                        isOpen={showEmailModal}
                        onClose={() => setShowEmailModal(false)}
                        onSent={(message) => {
                            setEmailFeedback({ type: 'success', message });
                        }}
                    />
                )}
            </main>
        </div>
    );
};

export default MeetingDetailsPage;
