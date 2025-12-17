import { useState, useEffect } from 'react';

export interface Title {
    id: number;
    name: string;
    abbreviation: string | null;
    priority: number;
}

export const useTitles = () => {
    const [titles, setTitles] = useState<Title[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTitles = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/titles`);
                if (!response.ok) {
                    throw new Error('Failed to fetch titles');
                }
                const data = await response.json();
                // Assuming data is { success: true, data: [...] }
                setTitles(data.data || []);
            } catch (err: any) {
                setError(err.message);
                console.error('Error fetching titles:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTitles();
    }, []);

    return { titles, loading, error };
};
