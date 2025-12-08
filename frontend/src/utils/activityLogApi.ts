import { auth } from '../firebase';

export interface ActivityLog {
    id: number;
    user_id: number | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: any;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    actor?: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
}

export interface ActivityLogResponse {
    data: {
        logs: ActivityLog[];
        pagination: {
            total: number;
            page: number;
            pages: number;
        };
    };
    success: boolean;
}

export interface ActivityLogParams {
    page?: number;
    limit?: number;
    userId?: number;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
}

/**
 * Fetch activity logs with pagination and filters
 */
export async function fetchActivityLogs(params: ActivityLogParams = {}): Promise<ActivityLogResponse['data']> {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        const token = await user.getIdToken();
        const queryParams = new URLSearchParams();

        if (params.page) queryParams.set('page', params.page.toString());
        if (params.limit) queryParams.set('limit', params.limit.toString());
        if (params.userId) queryParams.set('userId', params.userId.toString());
        if (params.action) queryParams.set('action', params.action);
        if (params.entityType) queryParams.set('entityType', params.entityType);
        if (params.startDate) queryParams.set('startDate', params.startDate);
        if (params.endDate) queryParams.set('endDate', params.endDate);

        const response = await fetch(
            `${process.env.REACT_APP_API_URL}/api/activity-logs?${queryParams.toString()}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch activity logs');
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
}
