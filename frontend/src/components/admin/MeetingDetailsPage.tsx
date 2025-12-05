import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AddTaskModal from './AddTaskModal';
import AddMeetingModal from './AddMeetingModal';

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
    title: string;
    meeting_date: string;
    location?: string;
    purpose?: string;
    agenda?: string;
    minutes?: string;
    attendees?: number[];
    creator?: Member;
    tasks?: Task[];
}

const MeetingDetailsPage: React.FC = () => {
    const { departmentId, meetingId } = useParams<{ departmentId: string; meetingId: string }>();
    const navigate = useNavigate();
    const { firebaseUser, user } = useAuth();

    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [previousMeeting, setPreviousMeeting] = useState<Meeting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showEditMeetingModal, setShowEditMeetingModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [departmentMembers, setDepartmentMembers] = useState<Member[]>([]);

    useEffect(() => {
        fetchMeetingDetails();
        fetchDepartmentMembers();
    }, [meetingId, firebaseUser, departmentId]);

    const fetchMeetingDetails = async () => {
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
    };

    const fetchDepartmentMembers = async () => {
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
    };

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

    const isLeader = ['admin', 'church_leadership'].includes(user?.role || '');

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
            <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate(`/departments/${departmentId}`)}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Back to Department
                    </button>

                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                    <span>
                                        <i className="fas fa-calendar mr-1"></i>
                                        {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
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
                            </div>
                            {isLeader && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowEditMeetingModal(true)}
                                        className="text-primary-600 hover:text-primary-700"
                                        title="Edit meeting"
                                    >
                                        <i className="fas fa-edit text-lg"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Previous Meeting Tasks */}
                {previousMeeting && previousMeeting.tasks && previousMeeting.tasks.length > 0 && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-history mr-2 text-gray-600"></i>
                            Tasks from Previous Meeting
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
                                                Assigned to: {task.assignee.first_name} {task.assignee.last_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Current Meeting Tasks */}
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                            <i className="fas fa-tasks mr-2 text-gray-600"></i>
                            Action Items from This Meeting
                        </h2>
                        <button
                            onClick={() => {
                                setSelectedTask(null);
                                setShowAddTaskModal(true);
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                        >
                            <i className="fas fa-plus mr-2"></i>
                            Add Task
                        </button>
                    </div>

                    {meeting.tasks && meeting.tasks.length > 0 ? (
                        <div className="space-y-3">
                            {meeting.tasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
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
                                                    Due: {new Date(task.end_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedTask(task);
                                            setShowAddTaskModal(true);
                                        }}
                                        className="text-primary-600 hover:text-primary-700 ml-4"
                                        title="Edit task"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">No action items yet</p>
                    )}
                </div>

                {/* Agenda */}
                {meeting.agenda && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-list-ul mr-2 text-gray-600"></i>
                            Agenda
                        </h2>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {meeting.agenda}
                            </div>
                        </div>
                    </div>
                )}

                {/* Meeting Notes */}
                {meeting.minutes && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-file-alt mr-2 text-gray-600"></i>
                            Meeting Notes
                        </h2>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {meeting.minutes}
                            </div>
                        </div>
                    </div>
                )}

                {/* Attendees */}
                {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            <i className="fas fa-users mr-2 text-gray-600"></i>
                            Attendees ({meeting.attendees.length})
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {departmentMembers
                                .filter(m => meeting.attendees?.includes(m.id))
                                .map((member) => (
                                    <div key={member.id} className="flex items-center p-2 bg-gray-50 rounded">
                                        <i className="fas fa-user-circle text-gray-400 mr-2"></i>
                                        <span className="text-sm text-gray-700">
                                            {member.first_name} {member.last_name}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

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
            </main>
        </div>
    );
};

export default MeetingDetailsPage;
