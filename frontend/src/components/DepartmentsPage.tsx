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
                        {departmentsToShow.map((dept) => (
                            <div
                                key={dept.id}
                                onClick={() => handleDepartmentClick(dept.id)}
                                className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                                        <p className="text-sm text-gray-500 capitalize mt-1">{dept.type}</p>
                                    </div>
                                    {dept.role && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            {dept.role}
                                        </span>
                                    )}
                                </div>

                                {dept.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{dept.description}</p>
                                )}

                                <div className="flex items-center justify-between text-sm text-gray-500">
                                    {dept.leader && (
                                        <span>
                                            <i className="fas fa-user-tie mr-1"></i>
                                            {dept.leader.first_name} {dept.leader.last_name}
                                        </span>
                                    )}
                                    {dept.member_count !== undefined && (
                                        <span>
                                            <i className="fas fa-users mr-1"></i>
                                            {dept.member_count} members
                                        </span>
                                    )}
                                </div>

                                {activeView === 'all' && !dept.role && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // TODO: Implement join request
                                            alert('Request to join functionality coming soon!');
                                        }}
                                        className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors text-sm"
                                    >
                                        Request to Join
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                            <i className="fas fa-users text-6xl"></i>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {activeView === 'my' ? 'No Departments Yet' : 'No Departments Available'}
                        </h3>
                        <p className="text-gray-600">
                            {activeView === 'my'
                                ? 'You are not part of any departments yet. Browse available departments to get started!'
                                : 'There are no available departments at this time.'}
                        </p>
                        {activeView === 'my' && allDepartments.length > 0 && (
                            <button
                                onClick={() => setActiveView('all')}
                                className="mt-4 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 transition-colors"
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
