import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AddMeetingModal from './admin/AddMeetingModal';
import AddTaskModal from './admin/AddTaskModal';
import ManageDepartmentMembersModal from './admin/ManageDepartmentMembersModal';

interface Department {
    id: number;
    name: string;
    description: string;
    type: string;
    role?: string;
    joined_at?: string;
    leader?: {
        id: number;
        first_name: string;
        last_name: string;
    };
    memberships?: Array<{
        id: number;
        member: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
        };
        role_in_department: string;
    }>;
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
    creator?: {
        first_name: string;
        last_name: string;
    };
}

interface Task {
    id: number;
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    assignee?: {
        first_name: string;
        last_name: string;
    };
}

const DepartmentDashboard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { firebaseUser, user } = useAuth();

    const [department, setDepartment] = useState<Department | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState<'members' | 'meetings' | 'tasks'>('members');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [showManageMembersModal, setShowManageMembersModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchDepartmentData = async () => {
            if (!id || !firebaseUser) return;

            try {
                console.log('🔄 Fetching department data for ID:', id);
                setLoading(true);
                const token = await firebaseUser.getIdToken();

                // Fetch department details
                console.log('📡 Fetching department details...');
                const deptResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/departments/${id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!deptResponse.ok) {
                    const errorText = await deptResponse.text();
                    console.error('❌ Failed to fetch department:', errorText);
                    throw new Error('Failed to fetch department');
                }

                const deptData = await deptResponse.json();
                console.log('✅ Department details loaded:', deptData.data.department.name);

                if (isMounted) {
                    setDepartment(deptData.data.department);
                }

                // Fetch meetings
                console.log('📡 Fetching meetings...');
                const meetingsResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/departments/${id}/meetings`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (meetingsResponse.ok && isMounted) {
                    const meetingsData = await meetingsResponse.json();
                    setMeetings(meetingsData.data.meetings);
                }

                // Fetch tasks
                console.log('📡 Fetching tasks...');
                const tasksResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/departments/${id}/tasks`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (tasksResponse.ok && isMounted) {
                    const tasksData = await tasksResponse.json();
                    setTasks(tasksData.data.tasks);
                }

                if (isMounted) setLoading(false);
            } catch (err) {
                console.error('❌ Error in fetchDepartmentData:', err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'An error occurred');
                    setLoading(false);
                }
            }
        };

        fetchDepartmentData();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]); // Only re-run if ID changes, ignore firebaseUser changes to prevent loops

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
            </div>
        );
    }

    if (error || !department) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        {error || 'Department not found'}
                    </h2>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
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

    return (
        <div className="min-h-screen bg-gray-50 pt-16">
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Back to Dashboard
                    </button>
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">{department.name}</h1>
                                <p className="text-sm text-gray-500 mt-1 capitalize">{department.type}</p>
                                {department.description && (
                                    <p className="text-gray-600 mt-2">{department.description}</p>
                                )}
                                {department.leader && (
                                    <p className="text-sm text-gray-500 mt-2">
                                        <strong>Leader:</strong> {department.leader.first_name} {department.leader.last_name}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                    {department.role || 'Member'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white shadow rounded-lg">
                    <div className="border-b border-gray-200 flex justify-between items-center pr-6">
                        <nav className="-mb-px flex">
                            <button
                                onClick={() => setActiveTab('members')}
                                className={`${activeTab === 'members'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                            >
                                <i className="fas fa-users mr-2"></i>
                                Members ({department.memberships?.length || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab('meetings')}
                                className={`${activeTab === 'meetings'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                            >
                                <i className="fas fa-calendar mr-2"></i>
                                Meetings ({meetings.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`${activeTab === 'tasks'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
                            >
                                <i className="fas fa-tasks mr-2"></i>
                                Tasks ({tasks.filter(t => t.status !== 'completed').length})
                            </button>
                        </nav>

                        {/* Action Buttons */}
                        <div>
                            {activeTab === 'meetings' && (
                                <button
                                    onClick={() => {
                                        setSelectedMeeting(null);
                                        setShowAddMeetingModal(true);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    <i className="fas fa-plus mr-1"></i>
                                    Add Meeting
                                </button>
                            )}
                            {activeTab === 'tasks' && (
                                <button
                                    onClick={() => {
                                        setSelectedTask(null);
                                        setShowAddTaskModal(true);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    <i className="fas fa-plus mr-1"></i>
                                    Add Task
                                </button>
                            )}
                            {activeTab === 'members' && (
                                <button
                                    onClick={() => setShowManageMembersModal(true)}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    <i className="fas fa-users-cog mr-1"></i>
                                    Manage Members
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Members Tab */}
                        {activeTab === 'members' && (
                            <div className="space-y-4">
                                {department.memberships && department.memberships.length > 0 ? (
                                    department.memberships.map((membership) => (
                                        <div
                                            key={membership.id}
                                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                                        >
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                                                    <i className="fas fa-user text-primary-800"></i>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {membership.member.first_name} {membership.member.last_name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{membership.member.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm text-gray-600 capitalize">
                                                {membership.role_in_department}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No members yet</p>
                                )}
                            </div>
                        )}

                        {/* Meetings Tab */}
                        {activeTab === 'meetings' && (
                            <div className="space-y-4">
                                {meetings.length > 0 ? (
                                    meetings.map((meeting) => (
                                        <div
                                            key={meeting.id}
                                            className="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-4"
                                            onClick={() => navigate(`/departments/${id}/meetings/${meeting.id}`)}
                                        >
                                            {/* Icon Container */}
                                            <div className="flex-shrink-0 w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                                                <i className="fas fa-folder-open text-primary-600 text-xl group-hover:scale-110 transition-transform duration-200"></i>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900 truncate pr-4 text-lg">
                                                            {meeting.title}
                                                        </h3>
                                                        {meeting.purpose && (
                                                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                                                {meeting.purpose}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end flex-shrink-0">
                                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                                                            <i className="far fa-calendar-alt mr-1.5 opacity-70"></i>
                                                            {new Date(meeting.meeting_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center mt-3 text-sm text-gray-500 gap-4">
                                                    {meeting.location && (
                                                        <span className="flex items-center">
                                                            <i className="fas fa-map-marker-alt mr-1.5 text-gray-400"></i>
                                                            {meeting.location}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center">
                                                        <i className="fas fa-users mr-1.5 text-gray-400"></i>
                                                        {meeting.attendees?.length || 0} attendees
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Indicator */}
                                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                                    <i className="fas fa-chevron-right text-gray-400"></i>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                            <i className="fas fa-folder-open text-gray-300 text-3xl"></i>
                                        </div>
                                        <p className="text-gray-500 font-medium">No meetings recorded yet</p>
                                        <button
                                            onClick={() => {
                                                setSelectedMeeting(null);
                                                setShowAddMeetingModal(true);
                                            }}
                                            className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
                                        >
                                            Create your first meeting
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tasks Tab */}
                        {activeTab === 'tasks' && (
                            <div className="space-y-4">
                                {tasks.length > 0 ? (
                                    tasks.map((task) => (
                                        <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900">{task.title}</h3>
                                                    {task.description && (
                                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                        {task.status.replace('_', ' ')}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                                {task.assignee && (
                                                    <span>
                                                        <i className="fas fa-user mr-1"></i>
                                                        {task.assignee.first_name} {task.assignee.last_name}
                                                    </span>
                                                )}
                                                {task.due_date && (
                                                    <span>
                                                        <i className="fas fa-calendar mr-1"></i>
                                                        Due: {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setSelectedTask(task);
                                                        setShowAddTaskModal(true);
                                                    }}
                                                    className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium ml-4"
                                                    title="Edit Task"
                                                >
                                                    <i className="fas fa-edit mr-1"></i>
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-8">No tasks yet</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals */}
                {showAddMeetingModal && department && (
                    <AddMeetingModal
                        departmentId={department.id}
                        departmentMembers={department.memberships?.map(m => m.member) || []}
                        meeting={selectedMeeting}
                        onClose={() => {
                            setShowAddMeetingModal(false);
                            setSelectedMeeting(null);
                        }}
                        onSuccess={() => {
                            // Refresh meetings list
                            const fetchMeetings = async () => {
                                const token = await firebaseUser?.getIdToken();
                                const response = await fetch(
                                    `${process.env.REACT_APP_API_URL}/api/departments/${id}/meetings`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                                if (response.ok) {
                                    const data = await response.json();
                                    setMeetings(data.data.meetings);
                                }
                            };
                            fetchMeetings();
                        }}
                    />
                )}

                {showAddTaskModal && department && (
                    <AddTaskModal
                        departmentId={department.id}
                        departmentMembers={department.memberships?.map(m => m.member) || []}
                        task={selectedTask}
                        onClose={() => {
                            setShowAddTaskModal(false);
                            setSelectedTask(null);
                        }}
                        onSuccess={() => {
                            // Refresh tasks list
                            const fetchTasks = async () => {
                                const token = await firebaseUser?.getIdToken();
                                const response = await fetch(
                                    `${process.env.REACT_APP_API_URL}/api/departments/${id}/tasks`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                                if (response.ok) {
                                    const data = await response.json();
                                    setTasks(data.data.tasks);
                                }
                            };
                            fetchTasks();
                        }}
                    />
                )}

                {showManageMembersModal && department && (
                    <ManageDepartmentMembersModal
                        department={department}
                        onClose={() => setShowManageMembersModal(false)}
                        onUpdate={() => {
                            // Refresh department data to show new members
                            // We can just trigger the same fetch effect by relying on ID or explicitly refetching
                            // For simplicity, let's just reload the page or we can extract the fetch function.
                            // Better: Duplicate the fetch logic for members or reload whole department.
                            navigate(0); // Simple reload to refresh all data
                        }}
                    />
                )}
            </main>
        </div>
    );
};

export default DepartmentDashboard;
