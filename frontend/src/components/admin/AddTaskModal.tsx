import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Member {
    id: number;
    first_name: string;
    last_name: string;
}

interface Task {
    id?: number;
    title: string;
    description?: string;
    assigned_to?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    start_date?: string;
    end_date?: string;
    rejected_date?: string;
    notes?: string;
}

interface AddTaskModalProps {
    departmentId: number;
    meetingId?: number;
    departmentMembers: Member[];
    task?: Task | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
    departmentId,
    meetingId,
    departmentMembers,
    task,
    onClose,
    onSuccess
}) => {
    const { firebaseUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Task>({
        title: '',
        description: '',
        assigned_to: undefined,
        status: 'pending',
        priority: 'medium',
        start_date: '',
        end_date: '',
        rejected_date: '',
        notes: ''
    });

    useEffect(() => {
        if (task) {
            setFormData(task);
        }
    }, [task]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate rejected_date when status is rejected
        if (formData.status === 'rejected' && !formData.rejected_date) {
            setError('Rejected date is required when status is rejected');
            setLoading(false);
            return;
        }

        try {
            const token = await firebaseUser?.getIdToken();
            const url = task?.id
                ? `${process.env.REACT_APP_API_URL}/api/departments/tasks/${task.id}`
                : `${process.env.REACT_APP_API_URL}/api/departments/${departmentId}/tasks`;

            const response = await fetch(url, {
                method: task?.id ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    department_id: departmentId,
                    meeting_id: meetingId,
                    assigned_to: formData.assigned_to || null,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    rejected_date: formData.rejected_date || null
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to save task');
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white mb-10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                        {task?.id ? 'Edit Task' : 'Create New Task'}
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Objective <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            placeholder="Brief description of the task"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Detailed description..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status <span className="text-red-600">*</span>
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="pending">Not Started</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assigned To
                            </label>
                            <select
                                value={formData.assigned_to || ''}
                                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Unassigned</option>
                                {departmentMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.first_name} {member.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {formData.status === 'rejected' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rejected Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.rejected_date}
                                    onChange={(e) => setFormData({ ...formData, rejected_date: e.target.value })}
                                    required={formData.status === 'rejected'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={4}
                            placeholder="Additional notes..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
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
                            {loading ? 'Saving...' : (task?.id ? 'Update Task' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTaskModal;
