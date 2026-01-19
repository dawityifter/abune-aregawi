import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
    member_count?: number;
}

const DepartmentsPage: React.FC = () => {
    const navigate = useNavigate();
    const { firebaseUser, user } = useAuth();

    const [myDepartments, setMyDepartments] = useState<Department[]>([]);
    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'my' | 'all'>('my');

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                setLoading(true);
                const token = await firebaseUser?.getIdToken();
                const memberId = user?.id; // Fixed: user object is flat, not nested

                console.log('🔍 DepartmentsPage Debug:', { token: token ? 'EXISTS' : 'MISSING', memberId, user });

                if (!token || !memberId) {
                    console.error('⚠️ Missing auth data:', { hasToken: !!token, memberId });
                    setLoading(false);
                    return;
                }

                // Fetch user's departments
                const myDeptResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/departments/members/${memberId}/departments`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('My Departments API response status:', myDeptResponse.status);
                if (myDeptResponse.ok) {
                    const myDeptData = await myDeptResponse.json();
                    console.log('My Departments data:', myDeptData);
                    setMyDepartments(myDeptData.data.departments);
                } else {
                    const errorText = await myDeptResponse.text();
                    console.error('Failed to fetch my departments:', errorText);
                }

                // Fetch all public departments
                const allDeptResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/departments?is_active=true&is_public=true&include_members=true`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('All Departments API response status:', allDeptResponse.status);
                if (allDeptResponse.ok) {
                    const allDeptData = await allDeptResponse.json();
                    console.log('All Departments data:', allDeptData);
                    setAllDepartments(allDeptData.data.departments);
                } else {
                    const errorText = await allDeptResponse.text();
                    console.error('Failed to fetch all departments:', errorText);
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching departments:', err);
                setLoading(false);
            }
        };

        fetchDepartments();
    }, [firebaseUser, user]);

    const handleDepartmentClick = (departmentId: number) => {
        navigate(`/departments/${departmentId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
            </div>
        );
    }

    // Auto-navigate if user has exactly one department
    if (myDepartments.length === 1 && activeView === 'my') {
        navigate(`/departments/${myDepartments[0].id}`);
        return null;
    }

    const departmentsToShow = activeView === 'my' ? myDepartments : allDepartments;

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
                    <h1 className="text-3xl font-bold text-gray-900">Departments & Service</h1>
                    <p className="text-gray-600 mt-2">
                        View your departments or explore opportunities to serve
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveView('my')}
                                className={`${activeView === 'my'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                My Departments ({myDepartments.length})
                            </button>
                            <button
                                onClick={() => setActiveView('all')}
                                className={`${activeView === 'all'
                                    ? 'border-primary-600 text-primary-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Browse All ({allDepartments.length})
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Departments Grid */}
                {departmentsToShow.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {departmentsToShow.map((dept) => {
                            const getSmartIcon = (dept: Department) => {
                                const name = dept.name.toLowerCase();
                                const type = dept.type.toLowerCase();

                                if (name.includes('choir') || name.includes('music') || name.includes('song') || name.includes('yamare')) return 'fas fa-music';
                                if (name.includes('sunday') || name.includes('school') || name.includes('timhirti')) return 'fas fa-graduation-cap';
                                if (name.includes('finance') || name.includes('treasur') || name.includes('money')) return 'fas fa-coins';
                                if (name.includes('social') || name.includes('event')) return 'fas fa-glass-cheers';
                                if (name.includes('building') || name.includes('maint')) return 'fas fa-tools';
                                if (name.includes('outreach') || name.includes('mission')) return 'fas fa-hands-helping';
                                if (name.includes('youth') || name.includes('young')) return 'fas fa-child';
                                if (name.includes('women') || name.includes('mother')) return 'fas fa-female';
                                if (name.includes('kitchen') || name.includes('food')) return 'fas fa-utensils';
                                if (name.includes('audit')) return 'fas fa-file-invoice';
                                if (name.includes('it ') || name.includes('tech') || name.includes('media')) return 'fas fa-laptop-code';
                                if (name.includes('pr ') || name.includes('relation')) return 'fas fa-bullhorn';
                                if (name.includes('board') || name.includes('admin')) return 'fas fa-user-tie';

                                switch (type) {
                                    case 'ministry': return 'fas fa-church';
                                    case 'committee': return 'fas fa-users-cog';
                                    case 'service': return 'fas fa-hand-holding-heart';
                                    case 'social': return 'fas fa-users';
                                    case 'administrative': return 'fas fa-cogs';
                                    default: return 'fas fa-folder';
                                }
                            };

                            const getTypeColor = (type: string) => {
                                switch (type) {
                                    case 'ministry': return 'bg-purple-100 text-purple-800';
                                    case 'committee': return 'bg-blue-100 text-blue-800';
                                    case 'service': return 'bg-green-100 text-green-800';
                                    case 'social': return 'bg-yellow-100 text-yellow-800';
                                    case 'administrative': return 'bg-gray-100 text-gray-800';
                                    default: return 'bg-gray-100 text-gray-800';
                                }
                            };

                            const icon = getSmartIcon(dept);

                            return (
                                <div
                                    key={dept.id}
                                    onClick={() => handleDepartmentClick(dept.id)}
                                    className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 cursor-pointer flex flex-col h-full"
                                >
                                    <div className="p-6 flex-1">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-50 transition-colors">
                                                <i className={`${icon} text-xl`}></i>
                                            </div>
                                            {dept.role && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800">
                                                    {dept.role}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary-700 transition-colors mb-2">
                                            {dept.name}
                                        </h3>

                                        <div className="mb-4">
                                            <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(dept.type)}`}>
                                                {dept.type}
                                            </span>
                                        </div>

                                        {dept.description && (
                                            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                                {dept.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 mt-auto">
                                        <div className="flex items-center justify-between text-sm text-gray-500">
                                            {dept.member_count !== undefined && (
                                                <span className="flex items-center">
                                                    <i className="fas fa-users mr-2 text-gray-400"></i>
                                                    {dept.member_count} members
                                                </span>
                                            )}
                                            <span className="group-hover:translate-x-1 transition-transform duration-200 text-primary-600 font-medium text-xs uppercase tracking-wide">
                                                View Details <i className="fas fa-arrow-right ml-1"></i>
                                            </span>
                                        </div>
                                    </div>

                                    {activeView === 'all' && !dept.role && (
                                        <div className="px-6 pb-4 bg-white -mt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    alert('Request to join functionality coming soon!');
                                                }}
                                                className="w-full bg-white border border-primary-600 text-primary-600 py-2 px-4 rounded-lg hover:bg-primary-50 transition-colors text-sm font-semibold"
                                            >
                                                Request to Join
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm border border-gray-200 border-dashed">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-6">
                            <i className="fas fa-layer-group text-4xl text-gray-300"></i>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {activeView === 'my' ? 'No Departments Found' : 'No Departments Available'}
                        </h3>
                        <p className="text-gray-500 max-w-sm text-center mb-8">
                            {activeView === 'my'
                                ? 'You haven\'t joined any departments yet. Browse the full list to find where you can serve.'
                                : 'There are currently no active departments to join.'}
                        </p>
                        {activeView === 'my' && allDepartments.length > 0 && (
                            <button
                                onClick={() => setActiveView('all')}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                                Browse Departments
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DepartmentsPage;
