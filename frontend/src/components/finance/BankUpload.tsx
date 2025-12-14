import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface BankUploadProps {
    onUploadSuccess: () => void;
}

const BankUpload: React.FC<BankUploadProps> = ({ onUploadSuccess }) => {
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !firebaseUser) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = await firebaseUser.getIdToken();
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const res = await fetch(`${apiUrl}/api/bank/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            setResult(data.data);
            setFile(null);
            // Trigger refresh in parent
            if (onUploadSuccess) onUploadSuccess();

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Bank Statement</h3>

            <div className="flex items-center space-x-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Chase CSV File
                    </label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100"
                    />
                </div>
                <div>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                        {uploading ? 'Uploading...' : 'Upload & Process'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}

            {result && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                    <p className="font-bold">Upload Successful!</p>
                    <ul className="list-disc pl-5 mt-1">
                        <li>Imported: {result.imported} new transactions</li>
                        <li>Skipped: {result.skipped} duplicates</li>
                    </ul>
                </div>
            )}

            <p className="mt-2 text-xs text-gray-500">
                Supported format: Chase Activity CSV. System automatically detects Zelle donors and skips duplicate transactions.
            </p>
        </div>
    );
};

export default BankUpload;
