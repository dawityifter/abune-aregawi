
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const getVoicemails = async (idToken: string, page = 1, limit = 10) => {
    const response = await fetch(`${API_URL}/api/twilio/admin/voicemails?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch voicemails');
    }

    return response.json();
};
