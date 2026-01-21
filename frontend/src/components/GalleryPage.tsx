import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webContentLink?: string;
    webViewLink?: string;
    thumbnailLink?: string;
}

const GalleryPage: React.FC = () => {
    const { folderId } = useParams<{ folderId: string }>();
    const navigate = useNavigate();
    const { firebaseUser, user } = useAuth();
    const userRole = user?.role;
    const { t } = useLanguage();
    const [images, setImages] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [currentIndex, setCurrentIndex] = useState(0);

    // Default folder ID from requirements if not provided in URL
    const targetFolderId = folderId || process.env.REACT_APP_GALLERY_FOLDER_ID || '1Bw2RcJYzfIPmamNPYvM-pQe_VhD51Aw_';

    useEffect(() => {
        const fetchImages = async () => {
            try {
                setLoading(true);
                if (!firebaseUser) return;
                const token = await firebaseUser.getIdToken();
                // Determine backend URL
                const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

                const response = await axios.get(`${backendUrl}/api/gallery/${targetFolderId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                setImages(response.data.data || []);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching gallery:', err);
                setError(err.response?.data?.message || t('gallery.loadError'));
            } finally {
                setLoading(false);
            }
        };

        fetchImages();
    }, [targetFolderId, firebaseUser]);

    const handleNext = () => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firebaseUser) return;

        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            alert(t('gallery.invalidFormat'));
            return;
        }

        try {
            setUploading(true);
            const token = await firebaseUser.getIdToken();
            const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

            const formData = new FormData();
            formData.append('image', file);

            const response = await axios.post(`${backendUrl}/api/gallery/${targetFolderId}/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            // Add new image to list and show it
            const newImage = response.data.file;
            setImages(prev => [newImage, ...prev]);
            setCurrentIndex(0); // Show uploaded image
            alert(t('gallery.uploadSuccess'));

        } catch (err: any) {
            console.error('Upload error:', err);
            alert(err.response?.data?.message || t('gallery.uploadError'));
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const canUpload = ['admin', 'church_leadership', 'secretary'].includes(userRole || '');

    const bgStyle: React.CSSProperties = {
        backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
        backgroundSize: 'auto',
    };

    const currentImage = images[currentIndex];

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4 sm:px-6 lg:px-8" style={bgStyle}>
            <div className="max-w-7xl mx-auto">
                <div className="bg-white/90 backdrop-blur-sm shadow rounded-lg p-6 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">
                                {t('gallery.title')}
                            </h1>
                            <p className="text-gray-600 mt-2 text-center md:text-left">
                                {t('gallery.subtitle')}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {canUpload && (
                                <>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/jpg"
                                    />
                                    <button
                                        onClick={handleUploadClick}
                                        disabled={uploading}
                                        className="flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                    >
                                        <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'} mr-2`}></i>
                                        {uploading ? t('gallery.uploading') : t('gallery.upload')}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                                <i className="fas fa-arrow-left mr-2"></i>
                                {t('common.back')}
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <i className="fas fa-exclamation-circle text-red-500"></i>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                                {error.includes('Key not found') && (
                                    <p className="text-xs text-red-600 mt-1">
                                        System Administrator: Please check backend API configuration.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : images.length === 0 ? (
                    <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
                        <i className="fas fa-images text-5xl mb-4 text-gray-300"></i>
                        <p className="text-gray-500 text-lg">{t('gallery.noImages')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        {/* Main Image View */}
                        <div className="relative w-full max-w-5xl aspect-w-16 aspect-h-9 bg-black rounded-xl shadow-2xl overflow-hidden mb-6 group">
                            <img
                                src={currentImage?.thumbnailLink ? currentImage.thumbnailLink.replace('=s220', '=s3000') : currentImage?.webContentLink}
                                alt={currentImage.name}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (currentImage.webContentLink && target.src !== currentImage.webContentLink) {
                                        target.src = currentImage.webContentLink;
                                    }
                                }}
                            />

                            {/* Navigation Arrows (Overlay) */}
                            <button
                                onClick={handlePrev}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-4 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                aria-label="Previous image"
                            >
                                <i className="fas fa-chevron-left text-2xl"></i>
                            </button>
                            <button
                                onClick={handleNext}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-4 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                aria-label="Next image"
                            >
                                <i className="fas fa-chevron-right text-2xl"></i>
                            </button>
                        </div>

                        {/* Navigation Controls & Counter */}
                        <div className="flex items-center justify-between w-full max-w-5xl bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-md">
                            <button
                                onClick={handlePrev}
                                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
                            >
                                <i className="fas fa-arrow-left mr-2"></i> {t('common.previous')}
                            </button>

                            <span className="text-gray-600 font-medium">
                                {t('gallery.counter')
                                    .replace('{current}', (currentIndex + 1).toString())
                                    .replace('{total}', images.length.toString())}
                            </span>

                            <button
                                onClick={handleNext}
                                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
                            >
                                {t('common.next')} <i className="fas fa-arrow-right ml-2"></i>
                            </button>
                        </div>


                    </div>
                )}
            </div>
        </div>
    );
};

export default GalleryPage;
